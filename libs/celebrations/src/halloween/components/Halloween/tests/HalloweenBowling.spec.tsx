import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as history from '../../../../utils/celebration-history';
import * as bowling from '../../../utils/halloween-bowling';
import HalloweenBowling from '../HalloweenBowling';

describe('bowling motion lifecycle', () => {
  const originalAnimate = Object.getOwnPropertyDescriptor(
    Element.prototype,
    'animate',
  );
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalAnimate)
      Object.defineProperty(Element.prototype, 'animate', originalAnimate);
    else delete (Element.prototype as Partial<Element>).animate;
  });
  const setup = (reduced: boolean) => {
    const events = new EventTarget();
    const media = {
      matches: reduced,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    );
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      1280,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      800,
    );
    const find = vi
      .spyOn(history, 'getCelebrationHistoryRows')
      .mockReturnValue([
        {
          element: document.createElement('li'),
          rect: new DOMRect(10, 300, 280, 36),
        },
      ]);
    const stop = vi.fn();
    const animate = vi.spyOn(bowling, 'animateBowling').mockReturnValue(stop);
    return {
      find,
      stop,
      animate,
      reduce: () =>
        act(() => {
          media.matches = true;
          events.dispatchEvent(new Event('change'));
        }),
    };
  };
  it('uses one trajectory throughout rerenders and cancels it on unmount', () => {
    const { animate, stop } = setup(false);
    const { rerender, unmount } = render(<HalloweenBowling />);
    rerender(<HalloweenBowling />);
    expect(animate).toHaveBeenCalledOnce();
    expect(stop).not.toHaveBeenCalled();
    unmount();
    expect(stop).toHaveBeenCalledOnce();
  });
  it('restores the rows and stops rolling when reduced motion is enabled', () => {
    const { animate, stop, reduce } = setup(false);
    render(<HalloweenBowling />);
    expect(animate).toHaveBeenCalledOnce();
    reduce();
    expect(stop).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledOnce();
  });
  it('does not borrow history with reduced motion', () => {
    const { animate } = setup(true);
    render(<HalloweenBowling />);
    expect(animate).not.toHaveBeenCalled();
  });
  it('shows standalone artwork when history is unavailable', () => {
    const { find, animate } = setup(false);
    find.mockReturnValue([]);
    render(<HalloweenBowling />);
    expect(animate).not.toHaveBeenCalled();
  });
});
