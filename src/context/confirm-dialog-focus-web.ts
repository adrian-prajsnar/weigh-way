/** Web-only helpers for keeping confirm-dialog focus inside interactive controls. */

export const CONFIRM_DIALOG_SELECTOR = '[data-ww-confirm-dialog="true"]';

const FOCUSABLE_SELECTOR =
  `${CONFIRM_DIALOG_SELECTOR} button, ` +
  `${CONFIRM_DIALOG_SELECTOR} input, ` +
  `${CONFIRM_DIALOG_SELECTOR} textarea, ` +
  `${CONFIRM_DIALOG_SELECTOR} [role="button"]`;

export function listConfirmDialogFocusables(root: ParentNode): HTMLElement[] {
  const nodes = root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  return Array.from(nodes).filter((element) => {
    if (element.getAttribute('aria-disabled') === 'true' || element.hasAttribute('disabled')) {
      return false;
    }
    if (element.tabIndex === -1) {
      return false;
    }
    return true;
  });
}

export function focusFirstConfirmDialogControl(root: ParentNode): void {
  const [first] = listConfirmDialogFocusables(root);
  first?.focus();
}

export function handleConfirmDialogTabKey(
  root: ParentNode,
  event: KeyboardEvent,
  activeElement: Element | null,
): void {
  if (event.key !== 'Tab') {
    return;
  }

  const focusables = listConfirmDialogFocusables(root);
  if (focusables.length === 0) {
    return;
  }

  const currentIndex = focusables.findIndex((node) => node === activeElement);
  if (currentIndex === -1) {
    event.preventDefault();
    focusFirstConfirmDialogControl(root);
    return;
  }

  const nextIndex = event.shiftKey
    ? (currentIndex - 1 + focusables.length) % focusables.length
    : (currentIndex + 1) % focusables.length;

  event.preventDefault();
  focusables[nextIndex]?.focus();
}
