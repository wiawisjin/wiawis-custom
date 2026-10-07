/**
 * 커스터마이저(Cloudflare) 쪽에 추가하는 코드
 * - wiawis.com 페이지 안에 iframe으로 들어갔을 때, 내 높이를 부모 페이지에 알려줌
 * - 단독으로 열렸을 때는 아무 동작도 하지 않음
 * index.html 맨 아래 <script src="/iframe-height-sync.js"></script> 로 불러오면 됩니다.
 */
(function () {
  const PARENT_ORIGINS = ['https://www.wiawis.com', 'https://wiawis.com'];

  if (window.parent === window) return; // 단독 실행이면 종료

  let lastHeight = 0;

  function sendHeight() {
    const height = document.documentElement.scrollHeight;
    if (Math.abs(height - lastHeight) < 2) return;
    lastHeight = height;
    PARENT_ORIGINS.forEach((origin) => {
      window.parent.postMessage({ type: 'wiawis-sim-height', height }, origin);
    });
  }

  // 단계 이동 등으로 화면이 바뀌었을 때 부모 페이지를 맨 위로 올리고 싶으면 호출
  window.wiawisScrollParentTop = function () {
    PARENT_ORIGINS.forEach((origin) => {
      window.parent.postMessage({ type: 'wiawis-sim-scroll-top' }, origin);
    });
  };

  new ResizeObserver(sendHeight).observe(document.documentElement);
  window.addEventListener('load', sendHeight);
})();
