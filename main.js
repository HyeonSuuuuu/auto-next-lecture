// 콜로소 페이지의 실제 JS 환경(MAIN world)에서 실행된다.
// 콜로소가 만든 Kollus 컨트롤러(VgControllerClient)를 붙잡아 재생 속도를 바꾼다.
(() => {
  let controller = null;
  let speed = 1;

  function applySpeed() {
    if (!controller || speed === 1) return;
    try {
      if (controller.get_speed() !== speed) {
        controller.set_speed(speed);
        console.log('[auto-next]', `재생 속도 ${speed}x 적용`);
      }
    } catch {
      // 플레이어가 아직 연결되지 않은 경우 다음 주기에 다시 시도한다.
    }
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
          setTimeout(applySpeed, 500);
        }
        return orig.apply(this, args);
      };
    }
    return true;
  }

  const waitForKollus = setInterval(() => patch() && clearInterval(waitForKollus), 500);

  // 다음 강의로 넘어가거나 플레이어가 속도를 되돌려도 설정한 속도를 유지한다.
  setInterval(applySpeed, 2000);

  // content.js(격리된 환경)에서 팝업 설정을 전달받는다.
  document.addEventListener('auto-next:speed', (e) => {
    const prev = speed;
    speed = Number(e.detail) || 1;
    if (speed === 1 && prev !== 1 && controller) {
      controller.set_speed(1);
      console.log('[auto-next]', '재생 속도 1.0x로 복원');
    }
    applySpeed();
  });
})();
