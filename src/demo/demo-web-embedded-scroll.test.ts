import { describe, expect, it } from 'vitest';
import {
  DEMO_EMBEDDED_CLASS,
  DEMO_EMBEDDED_DRAGGING_CLASS,
  markDemoEmbeddedDocument,
  resolveDragAxis,
} from './demo-web-embedded-scroll';

describe('markDemoEmbeddedDocument', () => {
  it('adds and removes the embedded marker class', () => {
    const html = {
      classList: {
        classes: new Set<string>(),
        add(...values: string[]) {
          values.forEach((value) => this.classes.add(value));
        },
        remove(...values: string[]) {
          values.forEach((value) => this.classes.delete(value));
        },
        contains(value: string) {
          return this.classes.has(value);
        },
      },
    };

    const cleanup = markDemoEmbeddedDocument({ documentElement: html as unknown as HTMLElement });

    expect(html.classList.contains(DEMO_EMBEDDED_CLASS)).toBe(true);

    cleanup();

    expect(html.classList.contains(DEMO_EMBEDDED_CLASS)).toBe(false);
    expect(html.classList.contains(DEMO_EMBEDDED_DRAGGING_CLASS)).toBe(false);
  });
});

describe('resolveDragAxis', () => {
  it('locks vertical drags on vertical-only containers', () => {
    expect(resolveDragAxis({ x: false, y: true }, 40, 4)).toBe('y');
    expect(resolveDragAxis({ x: false, y: true }, 4, 40)).toBe('y');
  });

  it('locks horizontal drags on horizontal-only containers', () => {
    expect(resolveDragAxis({ x: true, y: false }, 40, 4)).toBe('x');
    expect(resolveDragAxis({ x: true, y: false }, 4, 40)).toBe('x');
  });

  it('picks the dominant axis when both directions can scroll', () => {
    expect(resolveDragAxis({ x: true, y: true }, 40, 4)).toBe('x');
    expect(resolveDragAxis({ x: true, y: true }, 4, 40)).toBe('y');
  });

  it('returns null when the container cannot scroll', () => {
    expect(resolveDragAxis({ x: false, y: false }, 40, 40)).toBeNull();
  });
});
