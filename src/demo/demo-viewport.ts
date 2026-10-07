export const DEMO_PHONE_WIDTH = 390;
export const DEMO_PHONE_HEIGHT = 844;
export const DEMO_PHONE_CORNER_RADIUS = 28;
export const DEMO_FRAME_GAP = 24;
export const DEMO_DESKTOP_MIN_WIDTH = 600;

export type DemoFrameSize = {
  width: number;
  height: number;
};

export function shouldUseDemoPhoneFrame(windowWidth: number): boolean {
  return windowWidth >= DEMO_DESKTOP_MIN_WIDTH;
}

export function getDemoFrameSize(windowWidth: number, windowHeight: number): DemoFrameSize {
  const maxWidth = Math.max(320, windowWidth - DEMO_FRAME_GAP * 2);
  const maxHeight = Math.max(640, windowHeight - DEMO_FRAME_GAP * 2);

  return {
    width: Math.min(DEMO_PHONE_WIDTH, maxWidth),
    height: Math.min(DEMO_PHONE_HEIGHT, maxHeight),
  };
}
