const DELAY_SECONDS = 3;
const isTop = window === window.top;
const isKollus = /(^|\.)kollus\.com$/.test(location.hostname);

// 팝업의 켜기/끄기 스위치와 재생 속도
let enabled = true;
let speed = 1;
let resume = false;
chrome.storage.sync.get({ enabled: true, speed: 1, resume: false }, (s) => {
  enabled = s.enabled;
  speed = s.speed;
  resume = s.resume;
  sendSettings();
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) enabled = changes.enabled.newValue;
  if (changes.speed) speed = changes.speed.newValue;
  if (changes.resume) resume = changes.resume.newValue;
  sendSettings();
});

function log(...args) {
  console.log('[auto-next]', ...args);
}

// offsetParent는 position:fixed 요소에서 항상 null이라 팝업 버튼을 놓치므로 getClientRects로 판단한다.
function isVisible(el) {
  return el.getClientRects().length > 0 && !el.disabled;
}

// 콜로소 하단 바의 "이전/다음" 버튼. "코스"는 CSS ::after로만 붙어서 실제 글자는 "다음"뿐이다.
function findNextButton() {
  return [...document.querySelectorAll('button[data-course]')].find(
    (b) => b.innerText.trim() === '다음' && isVisible(b)
  );
}

// 오른쪽 아래에 글자와 버튼 하나가 있는 알림을 띄운다.
function showToast(buttonLabel, onButton) {
  const toast = document.createElement('div');
  toast.style.cssText =
    'position:fixed;right:20px;bottom:20px;z-index:2147483647;padding:12px 16px;' +
    'background:#222;color:#fff;border-radius:8px;font:14px sans-serif;' +
    'box-shadow:0 4px 12px rgba(0,0,0,.3);display:flex;gap:12px;align-items:center';
  const text = document.createElement('span');
  const button = document.createElement('button');
  button.textContent = buttonLabel;
  button.style.cssText =
    'background:#555;color:#fff;border:0;border-radius:4px;padding:4px 10px;cursor:pointer';
  button.addEventListener('click', onButton);
  toast.append(text, button);
  document.body.appendChild(toast);
  return { toast, text };
}

// 대기 시간 동안 취소할 수 있는 알림을 띄운 뒤 버튼을 누른다.
let pending = null;
function scheduleClick(btn) {
  if (pending) return;
  const { toast, text } = showToast('취소', () => {
    log('사용자가 취소함');
    done();
  });

  let remaining = DELAY_SECONDS;
  const tick = () => (text.textContent = `${remaining}초 후 다음 강의로 넘어갑니다`);
  tick();

  const done = () => {
    clearInterval(pending);
    pending = null;
    toast.remove();
  };

  pending = setInterval(() => {
    remaining -= 1;
    if (remaining > 0) return tick();
    done();
    log('클릭:', btn.textContent.trim());
    btn.click();
  }, 1000);
}

function handleEnded() {
  if (!enabled) return;
  log('영상 종료 감지', isTop ? '(최상위)' : `(iframe: ${location.hostname})`);
  // Kollus 같은 플레이어 iframe 안에서는 버튼을 찾지 않고 바로 바깥 페이지에 넘긴다.
  const btn = isKollus ? null : findNextButton();
  if (btn) return scheduleClick(btn);
  if (isTop) {
    log('다음 버튼을 찾지 못함');
  } else {
    // 플레이어가 iframe 안에 있고 버튼은 바깥 페이지에 있는 경우
    chrome.runtime.sendMessage({ type: 'VIDEO_ENDED' });
  }
}

if (isTop) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'VIDEO_ENDED') handleEnded();
  });
}

// 재생 시작과 속도는 콜로소 페이지의 Kollus 컨트롤러로 제어해야 해서 main.js에 설정을 전달한다.
// 격리된 환경의 객체는 페이지 쪽에서 읽을 수 없어서 JSON 문자열로 보낸다.
function sendSettings() {
  if (!isTop || isKollus) return;
  const detail = JSON.stringify({ enabled, speed });
  document.dispatchEvent(new CustomEvent('auto-next:settings', { detail }));
}
// main.js가 나중에 로드될 수도 있어 잠시 동안 몇 번 더 보낸다.
[1000, 3000, 6000].forEach((ms) => setTimeout(sendSettings, ms));

// main.js가 재생 요청을 여러 번 보냈는데도 멈춰 있고 페이지 클릭 기록이 없으면 이 이벤트를 보낸다.
// 크롬은 사용자가 페이지를 한 번도 클릭하지 않았으면 소리 있는 자동 재생을 막으므로 한 번 눌러 달라고 한다.
// 콜로소는 다음 강의로 넘어가도 페이지를 새로 불러오지 않아서, 한 번만 눌러 주면 이후 강의는 자동 재생된다.
let playToast = null;
document.addEventListener('auto-next:need-click', () => {
  if (!isTop || playToast) return;
  playToast = showToast('▶ 재생', () => {
    playToast.toast.remove();
    playToast = null;
    document.dispatchEvent(new CustomEvent('auto-next:play'));
  });
  playToast.text.textContent = '크롬 정책상 첫 재생은 직접 눌러야 해요';
});

const hooked = new WeakSet();
function hookVideos() {
  document.querySelectorAll('video').forEach((video) => {
    if (hooked.has(video)) return;
    hooked.add(video);
    video.addEventListener('ended', handleEnded);
    log('영상 감지됨', isTop ? '(최상위)' : '(iframe)');
  });
}

// 콜로소 페이지가 띄우는 "이전 재생 위치 ...부터 재생하시겠습니까?" 팝업에 답한다.
// resume 설정이 켜져 있으면 "예"(이어보기), 꺼져 있으면 "아니오"(처음부터)를 누른다.
const answered = new WeakSet();
function answerResumePrompt() {
  if (!enabled || isKollus) return;
  const dialog = document.querySelector('[data-testid="kr.classroom.player.dialog"]');
  if (!dialog?.textContent.includes('재생 위치')) return;
  const label = resume ? '예' : '아니오';
  const target = [...dialog.querySelectorAll('button')].find((b) => b.innerText.trim() === label);
  if (!target || answered.has(target) || !isVisible(target)) return;
  answered.add(target);
  log(`이어보기 팝업에서 "${label}" 클릭`);
  target.click();
  // 재생 시작은 main.js가 팝업이 닫힌 것을 보고 처리한다.
}

// 플레이어는 진행 바 때문에 DOM이 초당 여러 번 바뀌므로 몰아서 검사한다.
// requestAnimationFrame은 백그라운드 탭에서 멈추기 때문에 setTimeout을 쓴다.
let scheduled = false;
function onDomChange() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    hookVideos();
    answerResumePrompt();
  }, 300);
}

// 강의 사이트는 새로고침 없이 영상만 바꾸는 경우가 많아 DOM 변화를 계속 지켜본다.
new MutationObserver(onDomChange).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['style', 'class', 'hidden'],
});
onDomChange();
