import { afterEach, describe, expect, it, vi } from 'vitest';
import { borrowPenguinStarElement } from '../penguin-star-selector';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('borrowPenguinStarElement', () => {
  it('flies the existing control to the flipper and restores its own animation', () => {
    const button = document.createElement('button');
    button.textContent = 'A suggestion';
    document.body.append(button);
    button.focus();
    const original = button.outerHTML;
    const cancelAnimation = vi.fn();
    const animate = vi.fn().mockReturnValue({ cancel: cancelAnimation });
    Object.defineProperty(button, 'animate', {
      configurable: true,
      value: animate,
    });

    const restore = borrowPenguinStarElement(
      button,
      new DOMRect(100, 200, 80, 40),
      [280, 530],
    );
    expect(animate).toHaveBeenCalledOnce();
    const [frames, options] = animate.mock.calls[0] as [
      Keyframe[],
      KeyframeAnimationOptions,
    ];
    expect(frames[0].opacity).toBe(1);
    expect(frames.at(-1)?.opacity).toBe(0);
    expect(frames.at(-1)?.transform).toContain('translate(140px, 310px)');
    expect(options).toEqual(
      expect.objectContaining({ duration: 1600, fill: 'forwards' }),
    );
    expect(button.outerHTML).toBe(original);
    expect(document.activeElement).toBe(button);

    restore();
    restore();
    expect(cancelAnimation).toHaveBeenCalledOnce();
    expect(button.outerHTML).toBe(original);
    expect(document.activeElement).toBe(button);
  });

  it('does nothing when WAAPI is absent or fails', () => {
    const button = document.createElement('button');
    document.body.append(button);
    Object.defineProperty(button, 'animate', {
      configurable: true,
      value: undefined,
    });
    expect(() =>
      borrowPenguinStarElement(button, new DOMRect(), [0, 0])(),
    ).not.toThrow();
    const animate = vi.fn(() => {
      throw new Error('unavailable');
    });
    Object.defineProperty(button, 'animate', {
      configurable: true,
      value: animate,
    });
    expect(() =>
      borrowPenguinStarElement(button, new DOMRect(), [0, 0])(),
    ).not.toThrow();
    expect(animate).toHaveBeenCalledOnce();
  });
});
