const OPEN_ATTR = 'data-demo-open';
const MODAL_ATTR = 'data-demo-modal';
const IFRAME_ATTR = 'data-demo-iframe';
const CLOSE_ATTR = 'data-demo-close';
const SKELETON_ATTR = 'data-demo-skeleton';
const DIALOG_ATTR = 'data-demo-dialog';
const LOADING_CLASS = 'is-loading';
const STATUS_TIME_ATTR = 'data-demo-status-time';
const STATUS_CLOCK_INTERVAL_MS = 30_000;

export type DemoModalLoadingState = {
  isLoading: boolean;
  ariaBusy: 'true' | 'false';
  skeletonHidden: 'true' | 'false';
};

export function getDemoModalLoadingState(loading: boolean): DemoModalLoadingState {
  return {
    isLoading: loading,
    ariaBusy: loading ? 'true' : 'false',
    skeletonHidden: loading ? 'false' : 'true',
  };
}

function getModal(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${MODAL_ATTR}]`);
}

function getIframe(modal: HTMLElement): HTMLIFrameElement | null {
  return modal.querySelector<HTMLIFrameElement>(`[${IFRAME_ATTR}]`);
}

export function formatDemoStatusBarTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function initDemoStatusBarClock(modal: HTMLElement): void {
  const timeEl = modal.querySelector<HTMLElement>(`[${STATUS_TIME_ATTR}]`);
  if (!timeEl) {
    return;
  }

  const tick = () => {
    timeEl.textContent = formatDemoStatusBarTime(new Date());
  };

  tick();
  window.setInterval(tick, STATUS_CLOCK_INTERVAL_MS);
}

export function setDemoModalLoading(modal: HTMLElement, loading: boolean): void {
  const state = getDemoModalLoadingState(loading);
  modal.classList.toggle(LOADING_CLASS, state.isLoading);
  modal.querySelector<HTMLElement>(`[${DIALOG_ATTR}]`)?.setAttribute('aria-busy', state.ariaBusy);
  modal.querySelector<HTMLElement>(`[${SKELETON_ATTR}]`)?.setAttribute('aria-hidden', state.skeletonHidden);
}

export function initDemoModal(): void {
  const modal = getModal();
  const demoUrl = modal?.dataset.demoUrl;
  if (!modal || !demoUrl) {
    return;
  }

  initDemoStatusBarClock(modal);

  const iframe = getIframe(modal);
  let previousOverflow = '';
  let iframeLoaded = false;

  function handleIframeLoad(): void {
    iframeLoaded = true;
    setDemoModalLoading(modal, false);
  }

  function ensureIframeSource(): void {
    if (!iframe || iframe.src) {
      return;
    }

    iframe.addEventListener('load', handleIframeLoad, { once: true });
    iframe.src = demoUrl;
  }

  function openModal(): void {
    if (!iframe) {
      return;
    }

    ensureIframeSource();

    if (!iframeLoaded) {
      setDemoModalLoading(modal, true);
    }

    modal.hidden = false;
    document.body.classList.add('demo-modal-open');
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modal.querySelector<HTMLElement>('.demo-modal__dialog')?.focus();

    if (location.hash !== '#demo') {
      history.pushState(null, '', '#demo');
    }
  }

  function closeModal(): void {
    modal.hidden = true;
    document.body.classList.remove('demo-modal-open');
    document.body.style.overflow = previousOverflow;

    if (location.hash === '#demo') {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest(`[${OPEN_ATTR}]`)) {
      event.preventDefault();
      openModal();
      return;
    }

    if (target.closest(`[${CLOSE_ATTR}]`)) {
      event.preventDefault();
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) {
      closeModal();
    }
  });

  if (location.hash === '#demo') {
    openModal();
  }

  window.addEventListener('hashchange', () => {
    if (location.hash === '#demo') {
      openModal();
      return;
    }

    if (!modal.hidden) {
      closeModal();
    }
  });
}
