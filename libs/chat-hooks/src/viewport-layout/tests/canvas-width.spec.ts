import { describe, expect, it } from 'vitest';
import { CanvasWidthMode, resolveCanvasWidth } from '../canvas-width';
const policy = {
  minWidth: 400,
  defaultMaxWidth: 640,
  widthRatio: 0.33,
  minContentWidth: 400,
};

const fileManager = (viewportWidth: number, maxWidth = viewportWidth - 400) =>
  resolveCanvasWidth({
    mode: CanvasWidthMode.BoundedPanel,
    policy,
    isMobile: false,
    viewportWidth,
    maxWidth,
  });

describe('resolveCanvasWidth', () => {
  describe('file manager route', () => {
    it('opens at a third of a typical viewport', () => {
      expect(fileManager(1440).defaultWidth).toBe(475);
    });

    it('never opens narrower than 400 px', () => {
      expect(fileManager(1000).defaultWidth).toBe(400);
    });

    it('never opens wider than 640 px', () => {
      expect(fileManager(2560).defaultWidth).toBe(640);
    });

    it('stays within the maximum width the main content allows', () => {
      expect(fileManager(1440, 300).defaultWidth).toBe(300);
    });

    it('allows resizing down to 400 px', () => {
      expect(fileManager(1440).minWidth).toBe(400);
    });
  });

  describe('conversation routes', () => {
    it('opens at half the viewport and keeps the canvas minimum', () => {
      expect(
        resolveCanvasWidth({
          mode: CanvasWidthMode.Conversation,
          policy,
          isMobile: false,
          viewportWidth: 1440,
          maxWidth: 1040,
        }),
      ).toEqual({ defaultWidth: 720, minWidth: undefined });
    });

    it('stays within the maximum width', () => {
      expect(
        resolveCanvasWidth({
          mode: CanvasWidthMode.Conversation,
          policy,
          isMobile: false,
          viewportWidth: 1440,
          maxWidth: 500,
        }).defaultWidth,
      ).toBe(450);
    });
  });

  describe('mobile', () => {
    it('fills the viewport on every route', () => {
      for (const isFileManagerRoute of [true, false]) {
        expect(
          resolveCanvasWidth({
            mode: isFileManagerRoute
              ? CanvasWidthMode.BoundedPanel
              : CanvasWidthMode.Conversation,
            policy,
            isMobile: true,
            viewportWidth: 390,
            maxWidth: 0,
          }).defaultWidth,
        ).toBe(390);
      }
    });
  });
});
