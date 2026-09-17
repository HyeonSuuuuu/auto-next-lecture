const DELAY_SECONDS = 3;
const isTop = window === window.top;
const isKollus = /(^|\.)kollus\.com$/.test(location.hostname);

// 팝업의 켜기/끄기 스위치와 재생 속도
let enabled = true;
let speed = 1;
chrome.storage.sync.get({ enabled: true, speed: 1 }, (s) => {
  enabled = s.enabled;
  speed = s.speed;
  sendSpeed();
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) enabled = changes.enabled.newValue;
  if (changes.speed) {
    speed = changes.speed.newValue;
    sendSpeed();
  }
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

// 대기 시간 동안 취소할 수 있는 알림을 띄운 뒤 버튼을 누른다.
let pending = null;
function scheduleClick(btn) {
  if (pending) return;
  const toast = document.createElement('div');
  toast.style.cssText =
    'position:fixed;right:20px;bottom:20px;z-index:2147483647;padding:12px 16px;' +
    'background:#222;color:#fff;border-radius:8px;font:14px sans-serif;' +
    'box-shadow:0 4px 12px rgba(0,0,0,.3);display:flex;gap:12px;align-items:center';
  const text = document.createElement('span');
  const cancel = document.createElement('button');
  cancel.textContent = '취소';
  cancel.style.cssText =
    'background:#555;color:#fff;border:0;border-radius:4px;padding:4px 10px;cursor:pointer';
  toast.append(text, cancel);
  document.body.appendChild(toast);

  let remaining = DELAY_SECONDS;
  const tick = () => (text.textContent = `${remaining}초 후 다음 강의로 넘어갑니다`);
  tick();

  const done = () => {
    clearInterval(pending);
    pending = null;
    toast.remove();
  };
  cancel.addEventListener('click', () => {
    log('사용자가 취소함');
    done();
  });

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

// 재생 속도는 콜로소 페이지의 Kollus 컨트롤러로 바꿔야 해서 main.js에 전달한다.
function sendSpeed() {
  if (isTop && !isKollus) document.dispatchEvent(new CustomEvent('auto-next:speed', { detail: speed }));
}
// main.js가 나중에 로드될 수도 있어 잠시 동안 몇 번 더 보낸다.
[1000, 3000, 6000].forEach((ms) => setTimeout(sendSpeed, ms));

const hooked = new WeakSet();
function hookVideos() {
  document.querySelectorAll('video').forEach((video) => {
    if (hooked.has(video)) return;
    hooked.add(video);
    video.addEventListener('ended', handleEnded);
    log('영상 감지됨', isTop ? '(최상위)' : '(iframe)');
  });
}

// 콜로소 페이지가 띄우는 "이전 재생 위치 ...부터 재생하시겠습니까?" 팝업에서 "예"를 누른다.
const answered = new WeakSet();
function answerResumePrompt() {
  if (!enabled || isKollus) return;
  const dialog = document.querySelector('[data-testid="kr.classroom.player.dialog"]');
  if (!dialog?.textContent.includes('재생 위치')) return;
  const yes = [...dialog.querySelectorAll('button')].find((b) => b.innerText.trim() === '예');
  if (!yes || answered.has(yes) || !isVisible(yes)) return;
  answered.add(yes);
  log('이어보기 팝업에서 "예" 클릭');
  yes.click();
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
