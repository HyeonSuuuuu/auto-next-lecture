// iframe 안의 플레이어에서 영상이 끝났다는 신호를 받으면 같은 탭의 최상위 프레임에 전달한다.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== 'VIDEO_ENDED' || !sender.tab) return;
  chrome.tabs.sendMessage(sender.tab.id, msg, { frameId: 0 }).catch(() => {});
});
