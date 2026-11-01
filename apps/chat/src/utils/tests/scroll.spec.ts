import { describe, expect, it } from 'vitest';
import { scrollChildIntoContainerView } from '../scroll';

const withRect = (top: number, bottom: number): HTMLElement => {
  const element = document.createElement('div');
  element.getBoundingClientRect = () =>
    ({
      top,
      bottom,
      left: 0,
      right: 0,
      width: 0,
      height: bottom - top,
    }) as DOMRect;
  return element;
};

describe('scrollChildIntoContainerView', () => {
  it('scrolls down just enough to reveal a child below the fold', () => {
    const container = withRect(100, 300);
    container.scrollTop = 20;

    scrollChildIntoContainerView(container, withRect(320, 360));

    expect(container.scrollTop).toBe(80);
  });

  it('scrolls up just enough to reveal a child above the fold', () => {
    const container = withRect(100, 300);
    container.scrollTop = 200;

    scrollChildIntoContainerView(container, withRect(60, 90));

    expect(container.scrollTop).toBe(160);
  });

  it('leaves a fully visible child where it is', () => {
    const container = withRect(100, 300);
    container.scrollTop = 50;

    scrollChildIntoContainerView(container, withRect(150, 200));

    expect(container.scrollTop).toBe(50);
  });
});
