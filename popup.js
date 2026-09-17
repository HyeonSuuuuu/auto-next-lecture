const toggle = document.getElementById('enabled');
const speed = document.getElementById('speed');

// Kollus 플레이어가 제공하는 배속 범위(0.5x ~ 2.0x, 0.1 단위)와 똑같이 맞춘다.
for (let i = 5; i <= 20; i++) {
  const rate = (i / 10).toFixed(1);
  speed.add(new Option(`${rate}x`, rate));
}

chrome.storage.sync.get({ enabled: true, speed: 1 }, (s) => {
  toggle.checked = s.enabled;
  speed.value = Number(s.speed).toFixed(1);
});
toggle.addEventListener('change', () => chrome.storage.sync.set({ enabled: toggle.checked }));
speed.addEventListener('change', () => chrome.storage.sync.set({ speed: Number(speed.value) }));
