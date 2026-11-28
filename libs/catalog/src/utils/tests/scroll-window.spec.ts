import { describe, expect, it } from 'vitest';
import { scrollChildIntoContainerView } from '../scroll-window';

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
  it.each([
    [
      'scrolls down just enough to reveal a child below the fold',
      { scrollTop: 20, childTop: 320, childBottom: 360, expected: 80 },
    ],
    [
      'scrolls up just enough to reveal a child above the fold',
      { scrollTop: 200, childTop: 60, childBottom: 90, expected: 160 },
    ],
    [
      'leaves a fully visible child where it is',
      { scrollTop: 50, childTop: 150, childBottom: 200, expected: 50 },
    ],
  ])('%s', (_name, { scrollTop, childTop, childBottom, expected }) => {
    const container = withRect(100, 300);
    container.scrollTop = scrollTop;

    scrollChildIntoContainerView(container, withRect(childTop, childBottom));

    expect(container.scrollTop).toBe(expected);
  });
});
