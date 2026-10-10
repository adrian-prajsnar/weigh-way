const OPEN_ATTR = 'data-demo-open';
const MODAL_ATTR = 'data-demo-modal';
const IFRAME_ATTR = 'data-demo-iframe';
const CLOSE_ATTR = 'data-demo-close';
const SKELETON_ATTR = 'data-demo-skeleton';
const DIALOG_ATTR = 'data-demo-dialog';
const LOADING_CLASS = 'is-loading';
const STATUS_TIME_ATTR = 'data-demo-status-time';

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

/** Milliseconds until the next clock minute (status bar only needs minute precision). */
export function msUntilNextMinute(from: Date): number {
  const next = new Date(from);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);
  return Math.max(1, next.getTime() - from.getTime());
}

function createDemoStatusBarClock(modal: HTMLElement): { start: () => void; stop: () => void } {
  const timeEl = modal.querySelector<HTMLElement>(`[${STATUS_TIME_ATTR}]`);
  if (!timeEl) {
    return { start: () => {}, stop: () => {} };
  }

  let timer: number | undefined;

  const tick = () => {
    timeEl.textContent = formatDemoStatusBarTime(new Date());
    timer = window.setTimeout(tick, msUntilNextMinute(new Date()));
  };

  const stop = () => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
  };

  const start = () => {
    stop();
    tick();
  };

  return { start, stop };
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

  const statusBarClock = createDemoStatusBarClock(modal);

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

    statusBarClock.start();
  }

  function closeModal(): void {
    statusBarClock.stop();
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
