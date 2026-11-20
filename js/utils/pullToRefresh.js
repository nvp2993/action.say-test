import { state, triggerRender } from '../state/store.js';

export function initPullToRefresh() {
  if (document.getElementById('as-fb-ptr-indicator')) return;

  const ptrBox = document.createElement('div');
  ptrBox.id = 'as-fb-ptr-indicator';
  ptrBox.innerHTML = `<i id="as-fb-ptr-icon" class="fa-solid fa-arrow-down"></i><span id="as-fb-ptr-text">Kéo sâu & giữ để làm mới...</span>`;
  document.body.appendChild(ptrBox);

  const PULL_THRESHOLD = 145;
  const HOLD_MS = 550;
  let startY = 0, isPulling = false, isReady = false, holdTimer = null;

  function getScrollTop(target) {
    let el = target;
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.scrollHeight > el.clientHeight + 2 && el.scrollTop > 0) return el.scrollTop;
      el = el.parentElement;
    }
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    if (state.formModal || state.detailShowId || state.ctpBillModal || state.crewPassModal || state.bellDrawerOpen) return;
    if (getScrollTop(e.target) <= 0) {
      startY = e.touches[0].clientY; isPulling = true; isReady = false;
    }
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!isPulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0 || getScrollTop(e.target) > 0) {
      isPulling = false; clearTimeout(holdTimer); holdTimer = null;
      ptrBox.style.opacity = '0'; ptrBox.style.transform = 'translate(-50%, -90px) scale(0.85)';
      return;
    }
    if (dy > 45) {
      ptrBox.style.opacity = String(Math.min(1, (dy - 45) / 70));
      ptrBox.style.transform = `translate(-50%, ${Math.min(52, (dy - 45) * 0.4)}px) scale(1)`;
      if (dy >= PULL_THRESHOLD) {
        if (!holdTimer && !isReady) {
          document.getElementById('as-fb-ptr-text').textContent = 'Giữ yên tay một chút...';
          holdTimer = setTimeout(() => {
            isReady = true;
            ptrBox.classList.add('ready');
            document.getElementById('as-fb-ptr-icon').className = 'fa-solid fa-rotate fa-spin';
            document.getElementById('as-fb-ptr-text').textContent = 'Nhả tay để làm mới tức thì!';
            if (navigator.vibrate) navigator.vibrate(15);
          }, HOLD_MS);
        }
      } else {
        clearTimeout(holdTimer); holdTimer = null; isReady = false;
        ptrBox.classList.remove('ready');
        document.getElementById('as-fb-ptr-icon').className = 'fa-solid fa-arrow-down';
        document.getElementById('as-fb-ptr-text').textContent = 'Kéo sâu xuống để làm mới...';
      }
    }
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!isPulling) return;
    isPulling = false; clearTimeout(holdTimer); holdTimer = null;
    if (isReady) {
      document.getElementById('as-fb-ptr-icon').className = 'fa-solid fa-circle-check';
      document.getElementById('as-fb-ptr-text').textContent = 'Đã đồng bộ dữ liệu mới nhất!';
      triggerRender();
      setTimeout(() => {
        ptrBox.classList.remove('ready');
        ptrBox.style.opacity = '0';
        ptrBox.style.transform = 'translate(-50%, -90px) scale(0.85)';
      }, 550);
    } else {
      ptrBox.classList.remove('ready');
      ptrBox.style.opacity = '0';
      ptrBox.style.transform = 'translate(-50%, -90px) scale(0.85)';
    }
    isReady = false;
  }, { passive: true });
}