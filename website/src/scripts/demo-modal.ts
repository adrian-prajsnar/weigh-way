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

function getModal(): HTMLDialogElement | null {
  return document.querySelector<HTMLDialogElement>(`[${MODAL_ATTR}]`);
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

  const modalEl = modal;
  const resolvedDemoUrl = demoUrl;

  const statusBarClock = createDemoStatusBarClock(modalEl);

  const iframe = getIframe(modal);
  let opener: HTMLElement | null = null;
  let iframeLoaded = false;

  function handleIframeLoad(): void {
    // React Native Web text fields stop keydown before it can reach the document.
    iframe?.contentDocument?.addEventListener('keydown', handleFrameKeydown, { capture: true });
    iframeLoaded = true;
    setDemoModalLoading(modalEl, false);
  }

  function ensureIframeSource(): void {
    if (!iframe || iframe.src) {
      return;
    }

    iframe.src = resolvedDemoUrl;
  }

  function openModal(trigger?: HTMLElement): void {
    if (!iframe || modalEl.open) {
      return;
    }

    ensureIframeSource();

    if (!iframeLoaded) {
      setDemoModalLoading(modalEl, true);
    }

    opener = trigger ?? document.querySelector<HTMLElement>(`[${OPEN_ATTR}]`);
    modalEl.showModal();
    document.body.classList.add('demo-modal-open');

    if (location.hash !== '#demo') {
      history.pushState(null, '', '#demo');
    }

    statusBarClock.start();
  }

  function finishClose(): void {
    statusBarClock.stop();
    document.body.classList.remove('demo-modal-open');
    const fragment = document.getElementById(location.hash.slice(1));
    const returnTarget = fragment?.matches('main [tabindex]') ? fragment : opener;
    (returnTarget ?? document.getElementById('content'))?.focus({ preventScroll: true });
    opener = null;

    if (location.hash === '#demo') {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function handleFrameKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !event.isComposing && !event.defaultPrevented && modalEl.open) {
      // React Native Web dismisses its own dialogs on keyup.
      if (iframe?.contentDocument?.querySelector('[role="dialog"][aria-modal="true"], dialog[open]')) {
        return;
      }
      event.preventDefault();
      modalEl.close();
    }
  }

  document.querySelectorAll(`[${OPEN_ATTR}]`).forEach((trigger) => {
    trigger.setAttribute('aria-haspopup', 'dialog');
  });
  iframe?.addEventListener('load', handleIframeLoad);
  modalEl.addEventListener('close', finishClose);

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const trigger = target.closest<HTMLElement>(`[${OPEN_ATTR}]`);
    if (
      trigger && !event.defaultPrevented && event.button === 0 &&
      !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
    ) {
      event.preventDefault();
      openModal(trigger);
      return;
    }

    if (target.closest(`[${CLOSE_ATTR}]`)) {
      event.preventDefault();
      modalEl.close();
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

    if (modalEl.open) {
      modalEl.close();
    }
  });
}
