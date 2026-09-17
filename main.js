// 콜로소 페이지의 실제 JS 환경(MAIN world)에서 실행된다.
// 콜로소가 만든 Kollus 컨트롤러(VgControllerClient)를 붙잡아 재생 시작과 재생 속도를 제어한다.
(() => {
  const RESUME_DIALOG = '[data-testid="kr.classroom.player.dialog"]';
  const log = (...args) => console.log('[auto-next]', ...args);

  let controller = null;
  let enabled = true;
  let speed = 1;

  // 재생 시간이 실제로 흐르는지로 재생 여부를 판단한다.
  let lastTime = null;
  function isPlaying() {
    const now = controller.get_current_time();
    const playing = lastTime !== null && now > lastTime;
    lastTime = now;
    return playing;
  }

  // 플레이어가 준비되기 전에 속도를 바꾸면 로딩에서 멈출 수 있어서, 재생 중일 때만 적용한다.
  function applySpeed() {
    if (!controller || speed === 1) return;
    try {
      if (isPlaying() && controller.get_speed() !== speed) {
        controller.set_speed(speed);
        log(`재생 속도 ${speed}x 적용`);
      }
    } catch {
      // 플레이어가 아직 연결되지 않은 경우 다음 주기에 다시 시도한다.
    }
  }

  // 새 강의가 열리면 콜로소가 자동 재생하지 않는 경우가 있어서, 멈춰 있으면 재생을 요청한다.
  const AUTOPLAY_TRIES = 5;
  let autoplayTimer = null;
  function startAutoplay() {
    clearInterval(autoplayTimer);
    let tries = 0;
    let prev = null;
    autoplayTimer = setInterval(() => {
      if (!enabled || !controller) return;
      // 이어보기 팝업은 content.js가 "예"를 누를 때까지 기다린다.
      if (document.querySelector(RESUME_DIALOG)) return;
      let now;
      try {
        now = controller.get_current_time();
      } catch {
        return;
      }
      if (prev !== null && now > prev) {
        clearInterval(autoplayTimer);
        return;
      }
      prev = now;
      if (++tries > AUTOPLAY_TRIES) {
        clearInterval(autoplayTimer);
        // 크롬은 사용자가 페이지를 한 번도 클릭하지 않았으면 소리 있는 자동 재생을 막는다.
        if (!navigator.userActivation.hasBeenActive) {
          document.dispatchEvent(new CustomEvent('auto-next:need-click'));
        }
        return;
      }
      controller.play();
      log('재생 요청');
    }, 2000);
  }

  // 컨트롤러 인스턴스는 전역에 없어서, 플레이어와 메시지를 주고받는 메서드를 감싸 인스턴스를 얻는다.
  function patch() {
    const P = window.VgControllerClient?.prototype;
    if (!P || P.__autoNextPatched) return !!P;
    P.__autoNextPatched = true;
    for (const name of ['receive', 'send']) {
      const orig = P[name];
      if (typeof orig !== 'function') continue;
      P[name] = function (...args) {
        if (controller !== this) {
          controller = this;
          lastTime = null;
          startAutoplay();
        }
        return orig.apply(this, args);
      };
    }
    return true;
  }

  const waitForKollus = setInterval(() => patch() && clearInterval(waitForKollus), 500);

  // 강의가 바뀌어도 콜로소가 컨트롤러를 재사용할 수 있어서, 플레이어 iframe 주소가 바뀌면 재생 확인을 다시 시작한다.
  let playerSrc = null;
  setInterval(() => {
    const src = document.querySelector('iframe[src*="kollus"]')?.src ?? null;
    if (src === playerSrc) return;
    playerSrc = src;
    if (src && controller) {
      lastTime = null;
      startAutoplay();
    }
  }, 1000);

  // 다음 강의로 넘어가거나 플레이어가 속도를 되돌려도 설정한 속도를 유지한다.
  setInterval(applySpeed, 2000);

  // "▶ 재생" 알림을 누르면 content.js가 보낸다. 사용자 클릭 직후라 재생이 허용된다.
  document.addEventListener('auto-next:play', () => {
    if (!controller) return log('플레이어 컨트롤러를 아직 찾지 못함');
    controller.play();
    log('재생 요청 (사용자 클릭)');
  });

  // content.js(격리된 환경)에서 팝업 설정을 JSON 문자열로 전달받는다.
  document.addEventListener('auto-next:settings', (e) => {
    const settings = JSON.parse(e.detail);
    enabled = settings.enabled;
    const prev = speed;
    speed = Number(settings.speed) || 1;
    if (speed === 1 && prev !== 1 && controller) {
      controller.set_speed(1);
      log('재생 속도 1.0x로 복원');
    }
  });
})();
