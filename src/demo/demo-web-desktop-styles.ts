import { Palette } from '../theme/tokens';
import { buildWebFocusRingCssVars } from '../theme/web-focus-ring';
import { DEMO_EMBEDDED_CLASS, DEMO_EMBEDDED_DRAGGING_CLASS } from './demo-web-embedded-scroll';
import { DEMO_PHONE_CORNER_RADIUS } from './demo-viewport';

export const DEMO_WEB_DESKTOP_STYLE_ID = 'weigh-way-demo-web-desktop';

const DESKTOP_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

/** Pulls the confirm-overlay ring inside the phone corner clip without shrinking the overlay. */
const CONFIRM_OVERLAY_RING_INSET = 8;

export function buildDemoWebDesktopCss(colors: Palette, embedded = false): string {
  const embeddedCursorCss = embedded
    ? `
      html.${DEMO_EMBEDDED_CLASS},
      html.${DEMO_EMBEDDED_CLASS} body,
      html.${DEMO_EMBEDDED_CLASS} #root {
        cursor: grab;
      }

      html.${DEMO_EMBEDDED_CLASS}.${DEMO_EMBEDDED_DRAGGING_CLASS},
      html.${DEMO_EMBEDDED_CLASS}.${DEMO_EMBEDDED_DRAGGING_CLASS} body,
      html.${DEMO_EMBEDDED_CLASS}.${DEMO_EMBEDDED_DRAGGING_CLASS} #root {
        cursor: grabbing;
      }

      html.${DEMO_EMBEDDED_CLASS}.${DEMO_EMBEDDED_DRAGGING_CLASS},
      html.${DEMO_EMBEDDED_CLASS}.${DEMO_EMBEDDED_DRAGGING_CLASS} * {
        user-select: none;
        -webkit-user-select: none;
      }

      html.${DEMO_EMBEDDED_CLASS}.${DEMO_EMBEDDED_DRAGGING_CLASS} [role="button"],
      html.${DEMO_EMBEDDED_CLASS}.${DEMO_EMBEDDED_DRAGGING_CLASS} button,
      html.${DEMO_EMBEDDED_CLASS}.${DEMO_EMBEDDED_DRAGGING_CLASS} a,
      html.${DEMO_EMBEDDED_CLASS}.${DEMO_EMBEDDED_DRAGGING_CLASS} div[tabindex="0"] {
        pointer-events: none;
      }
    `
    : '';

  return `
    :root {
      --ww-accent: ${colors.accent};
      --ww-accent-soft: ${colors.accentSoft};
      --ww-accent-border: ${colors.accentBorder};
      --ww-on-accent: ${colors.onAccent};
      --ww-surface: ${colors.surface};
      --ww-surface-muted: ${colors.surfaceMuted};
      --ww-border-strong: ${colors.borderStrong};
      ${buildWebFocusRingCssVars()}
    }

    @media ${DESKTOP_POINTER_QUERY} {
      ${embeddedCursorCss}

      [role="button"],
      div[tabindex="0"],
      button,
      a,
      input,
      textarea,
      select {
        outline: none;
      }

      [role="button"],
      div[tabindex="0"],
      button,
      a {
        cursor: pointer;
        transition: opacity 0.15s ease, background-color 0.15s ease, border-color 0.15s ease,
          box-shadow 0.15s ease;
      }

      input[type="text"],
      input[type="email"],
      input[type="password"],
      input[type="number"],
      input[type="search"],
      input[type="tel"],
      input[type="url"],
      textarea,
      select {
        cursor: text;
        transition: box-shadow 0.15s ease, border-color 0.15s ease;
      }

      input:focus-visible:not([data-ww-field-input="true"]),
      textarea:focus-visible,
      select:focus-visible {
        box-shadow: var(--ww-focus-ring-control);
      }

      input[data-ww-field-input="true"]:focus-visible {
        box-shadow: none;
      }

      [data-ww-weight-field="true"]:has(> input:focus-visible) {
        box-shadow: var(--ww-focus-ring-control);
      }

      div:has(> textarea:focus-visible) {
        box-shadow: var(--ww-focus-ring-control);
      }

      [role="button"]:not([aria-disabled="true"]):not([data-ww-modal-dismiss="true"]):hover,
      div[tabindex="0"]:not([aria-disabled="true"]):not([data-ww-modal-dismiss="true"]):hover,
      button:not(:disabled):not([data-ww-modal-dismiss="true"]):hover {
        opacity: 0.9;
      }

      [role="button"]:focus:not(:focus-visible),
      div[tabindex="0"]:focus:not(:focus-visible),
      button:focus:not(:focus-visible) {
        box-shadow: none;
      }

      [role="button"]:not([aria-disabled="true"]):not([data-ww-modal-dismiss="true"]):not([data-ww-stepper-button="true"]):not([data-ww-text-button="true"]):not([data-ww-segmented-item="true"]):focus-visible,
      div[tabindex="0"]:not([aria-disabled="true"]):not([data-ww-text-button="true"]):not([data-ww-segmented-item="true"]):not([role="switch"]):focus-visible,
      button:not(:disabled):not([data-ww-modal-dismiss="true"]):not([data-ww-stepper-button="true"]):not([data-ww-text-button="true"]):not([data-ww-segmented-item="true"]):focus-visible {
        position: relative;
        z-index: 1;
        box-shadow: var(--ww-focus-ring-button);
      }

      [data-ww-text-button="true"] {
        border-radius: 6px;
        padding: 3px 6px;
        margin: -3px -6px;
      }

      [data-ww-text-button="true"]:focus-visible {
        position: relative;
        z-index: 1;
        box-shadow: var(--ww-focus-ring-text);
      }

      [data-ww-segmented-item="true"]:focus-visible {
        position: relative;
        z-index: 1;
        box-shadow: var(--ww-focus-ring-text);
      }

      [data-ww-switch="true"] {
        align-self: flex-start;
        border-radius: 999px;
        padding: 3px;
        margin: -3px;
      }

      [data-ww-switch="true"]:focus-within {
        position: relative;
        z-index: 1;
        box-shadow: var(--ww-focus-ring-switch);
      }

      [data-ww-switch="true"] [role="switch"]:focus-visible,
      [data-ww-switch="true"] [role="switch"]:focus:not(:focus-visible) {
        box-shadow: none;
      }

      [role="switch"]:focus-visible {
        box-shadow: none;
      }

      [data-ww-stepper-button="true"]:focus-visible {
        position: relative;
        z-index: 1;
        box-shadow: var(--ww-focus-ring-compact);
      }

      [data-ww-modal-dismiss="true"]:focus:not(:focus-visible) {
        box-shadow: none;
      }

      [data-ww-modal-dismiss="true"]:focus-visible {
        box-shadow: var(--ww-focus-ring-overlay);
      }

      [data-ww-confirm-dismiss="true"]:focus-visible {
        box-shadow: none;
      }

      [data-ww-confirm-dismiss="true"]:focus-visible::after {
        content: "";
        position: absolute;
        pointer-events: none;
        inset: ${CONFIRM_OVERLAY_RING_INSET}px;
        border-radius: ${DEMO_PHONE_CORNER_RADIUS - CONFIRM_OVERLAY_RING_INSET}px;
        box-shadow: var(--ww-focus-ring-overlay);
      }

      [data-ww-confirm-dialog="true"] {
        overflow: visible;
      }

      a:hover {
        text-decoration: underline;
      }
    }

    @media ${DESKTOP_POINTER_QUERY} and (prefers-reduced-motion: reduce) {
      [role="button"],
      div[tabindex="0"],
      button,
      a,
      input,
      textarea,
      select {
        transition: none;
      }
    }
  `;
}
