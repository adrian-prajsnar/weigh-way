export const DEMO_EMBEDDED_CLASS = 'ww-demo-embedded';
export const DEMO_EMBEDDED_DRAGGING_CLASS = 'ww-desktop-dragging';

const DRAG_START_PX = 8;
const MIN_OVERFLOW_PX = 4;

export type ScrollAxes = {
  x: boolean;
  y: boolean;
};

export type DragAxis = 'x' | 'y';

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest('input, textarea, select, button, a, [role="button"], [contenteditable="true"]'))
  );
}

export function getScrollAxes(node: HTMLElement, getStyle: (element: HTMLElement) => CSSStyleDeclaration): ScrollAxes {
  const style = getStyle(node);
  const canOverflowX = style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflowX === 'overlay';
  const canOverflowY = style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay';

  return {
    x: canOverflowX && node.scrollWidth > node.clientWidth + MIN_OVERFLOW_PX,
    y: canOverflowY && node.scrollHeight > node.clientHeight + MIN_OVERFLOW_PX,
  };
}

export function resolveDragAxis(axes: ScrollAxes, deltaX: number, deltaY: number): DragAxis | null {
  if (!axes.x && !axes.y) {
    return null;
  }

  if (axes.x && !axes.y) {
    return 'x';
  }

  if (axes.y && !axes.x) {
    return 'y';
  }

  return Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
}

function getScrollableAncestor(
  target: EventTarget | null,
  getStyle: (element: HTMLElement) => CSSStyleDeclaration,
): HTMLElement | null {
  let node = target instanceof Element ? target : null;

  while (node && node !== document.documentElement) {
    if (!(node instanceof HTMLElement)) {
      node = node.parentElement;
      continue;
    }

    const axes = getScrollAxes(node, getStyle);
    if (axes.x || axes.y) {
      return node;
    }

    node = node.parentElement;
  }

  return null;
}

function clearTextSelection(): void {
  window.getSelection()?.removeAllRanges();
}

/** Click-drag scrolling for the embedded web demo on fine-pointer desktops. */
export function bindDemoWebEmbeddedScroll(targetWindow: Window = window): () => void {
  const doc = targetWindow.document;
  const getStyle = (element: HTMLElement) => targetWindow.getComputedStyle(element);
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let scrollLeft = 0;
  let scrollTop = 0;
  let scrollTarget: HTMLElement | null = null;
  let scrollAxes: ScrollAxes | null = null;
  let dragAxis: DragAxis | null = null;
  let dragging = false;
  let suppressClick = false;

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || isInteractiveTarget(event.target)) {
      return;
    }

    scrollTarget = getScrollableAncestor(event.target, getStyle);
    if (!scrollTarget) {
      return;
    }

    scrollAxes = getScrollAxes(scrollTarget, getStyle);
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    scrollLeft = scrollTarget.scrollLeft;
    scrollTop = scrollTarget.scrollTop;
    dragAxis = null;
    dragging = false;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId || !scrollTarget || !scrollAxes) {
      return;
    }

    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    if (!dragging && Math.hypot(deltaX, deltaY) < DRAG_START_PX) {
      return;
    }

    if (!dragging) {
      const axis = resolveDragAxis(scrollAxes, deltaX, deltaY);
      if (!axis) {
        pointerId = null;
        scrollTarget = null;
        scrollAxes = null;
        return;
      }

      dragging = true;
      dragAxis = axis;
      clearTextSelection();
      doc.documentElement.classList.add(DEMO_EMBEDDED_DRAGGING_CLASS);
      scrollTarget.setPointerCapture(event.pointerId);
    }

    event.preventDefault();

    if (dragAxis === 'x') {
      scrollTarget.scrollLeft = scrollLeft - deltaX;
      return;
    }

    scrollTarget.scrollTop = scrollTop - deltaY;
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) {
      return;
    }

    const didDrag = dragging;
    if (scrollTarget?.hasPointerCapture(event.pointerId)) {
      scrollTarget.releasePointerCapture(event.pointerId);
    }

    pointerId = null;
    scrollTarget = null;
    scrollAxes = null;
    dragAxis = null;
    dragging = false;
    doc.documentElement.classList.remove(DEMO_EMBEDDED_DRAGGING_CLASS);
    clearTextSelection();

    if (!didDrag) {
      return;
    }

    suppressClick = true;
    event.preventDefault();
    event.stopPropagation();
  };

  const onClick = (event: MouseEvent) => {
    if (!suppressClick) {
      return;
    }

    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const onSelectStart = (event: Event) => {
    if (!dragging) {
      return;
    }

    event.preventDefault();
  };

  const onDragStart = (event: Event) => {
    if (!dragging) {
      return;
    }

    event.preventDefault();
  };

  targetWindow.addEventListener('pointerdown', onPointerDown, true);
  targetWindow.addEventListener('pointermove', onPointerMove, true);
  targetWindow.addEventListener('pointerup', onPointerUp, true);
  targetWindow.addEventListener('pointercancel', onPointerUp, true);
  targetWindow.addEventListener('click', onClick, true);
  targetWindow.addEventListener('selectstart', onSelectStart, true);
  targetWindow.addEventListener('dragstart', onDragStart, true);

  return () => {
    doc.documentElement.classList.remove(DEMO_EMBEDDED_DRAGGING_CLASS);
    targetWindow.removeEventListener('pointerdown', onPointerDown, true);
    targetWindow.removeEventListener('pointermove', onPointerMove, true);
    targetWindow.removeEventListener('pointerup', onPointerUp, true);
    targetWindow.removeEventListener('pointercancel', onPointerUp, true);
    targetWindow.removeEventListener('click', onClick, true);
    targetWindow.removeEventListener('selectstart', onSelectStart, true);
    targetWindow.removeEventListener('dragstart', onDragStart, true);
  };
}

export function markDemoEmbeddedDocument(doc: Pick<Document, 'documentElement'> = document): () => void {
  doc.documentElement.classList.add(DEMO_EMBEDDED_CLASS);

  return () => {
    doc.documentElement.classList.remove(DEMO_EMBEDDED_CLASS);
    doc.documentElement.classList.remove(DEMO_EMBEDDED_DRAGGING_CLASS);
  };
}
