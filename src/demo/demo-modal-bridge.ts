export const DEMO_MODAL_MESSAGE_SOURCE = 'weigh-way-demo';

const DRAG_START_PX = 8;

export type DemoModalDragMessage =
  | { source: typeof DEMO_MODAL_MESSAGE_SOURCE; type: 'drag'; x: number; y: number }
  | { source: typeof DEMO_MODAL_MESSAGE_SOURCE; type: 'drag-end' };

export function isDemoModalDragMessage(value: unknown): value is DemoModalDragMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as DemoModalDragMessage;
  if (message.source !== DEMO_MODAL_MESSAGE_SOURCE) {
    return false;
  }

  if (message.type === 'drag-end') {
    return true;
  }

  return message.type === 'drag' && typeof message.x === 'number' && typeof message.y === 'number';
}

function isTextEntry(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

/** Lets the parent phone frame follow a mouse drag without taking wheel or touch scrolling. */
export function bindDemoModalDragBridge(targetWindow: Window = window): () => void {
  if (targetWindow.parent === targetWindow) {
    return () => {};
  }

  const parent = targetWindow.parent;
  const origin = targetWindow.location.origin;
  const style = targetWindow.document.createElement('style');
  style.textContent = `
    html, body, #root { cursor: grab; }
    button, a, input, textarea, select, [role="button"] { cursor: pointer; }
  `;
  targetWindow.document.head.appendChild(style);
  let pointerId: number | null = null;
  let originX = 0;
  let originY = 0;
  let dragging = false;
  let suppressClick = false;

  const post = (message: DemoModalDragMessage) => {
    parent.postMessage(message, origin);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || isTextEntry(event.target)) {
      return;
    }

    pointerId = event.pointerId;
    originX = event.clientX;
    originY = event.clientY;
    dragging = false;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) {
      return;
    }

    const x = event.clientX - originX;
    const y = event.clientY - originY;
    if (!dragging && Math.hypot(x, y) < DRAG_START_PX) {
      return;
    }

    dragging = true;
    post({ source: DEMO_MODAL_MESSAGE_SOURCE, type: 'drag', x, y });
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) {
      return;
    }

    const didDrag = dragging;
    pointerId = null;
    dragging = false;
    if (!didDrag) {
      return;
    }

    suppressClick = true;
    event.preventDefault();
    event.stopPropagation();
    post({ source: DEMO_MODAL_MESSAGE_SOURCE, type: 'drag-end' });
  };

  const onClick = (event: MouseEvent) => {
    if (!suppressClick) {
      return;
    }

    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  targetWindow.addEventListener('pointerdown', onPointerDown, true);
  targetWindow.addEventListener('pointermove', onPointerMove, true);
  targetWindow.addEventListener('pointerup', onPointerUp, true);
  targetWindow.addEventListener('pointercancel', onPointerUp, true);
  targetWindow.addEventListener('click', onClick, true);

  return () => {
    style.remove();
    targetWindow.removeEventListener('pointerdown', onPointerDown, true);
    targetWindow.removeEventListener('pointermove', onPointerMove, true);
    targetWindow.removeEventListener('pointerup', onPointerUp, true);
    targetWindow.removeEventListener('pointercancel', onPointerUp, true);
    targetWindow.removeEventListener('click', onClick, true);
  };
}
