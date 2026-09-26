import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as train from '../../../utils/halloween-train';
import HalloweenTrain from '../HalloweenTrain';

vi.mock('../HalloweenTrainArtwork', () => ({
  default: ({ foreground }: { foreground?: boolean }) => (
    <svg aria-label={foreground ? 'Wagon front' : 'Empty ghost train'} />
  ),
}));

describe('pumpkin train motion lifecycle', () => {
  const animateDescriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    'animate',
  );
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (animateDescriptor)
      Object.defineProperty(Element.prototype, 'animate', animateDescriptor);
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
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(320, 610, 640, 170),
    );
    const source = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    );
    vi.spyOn(source, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(1130, 40, 96, 96),
    );
    const find = vi.spyOn(train, 'getTrainPumpkin').mockReturnValue(source);
    const stop = vi.fn();
    const animate = vi
      .spyOn(train, 'animateHalloweenTrain')
      .mockReturnValue(stop);
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

  it('shows static train artwork without borrowing the pumpkin with reduced motion', () => {
    const { find, animate } = setup(true);
    render(<HalloweenTrain />);
    expect(screen.getByLabelText('Empty ghost train')).toBeTruthy();
    expect(screen.getByLabelText('Wagon front')).toBeTruthy();
    expect(find).not.toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();
  });

  it('immediately restores the pumpkin when reduced motion is enabled during boarding', () => {
    const { animate, stop, reduce } = setup(false);
    render(<HalloweenTrain />);
    expect(animate).toHaveBeenCalledOnce();
    reduce();
    expect(stop).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Empty ghost train')).toBeTruthy();
  });

  it('keeps one journey on rerender and releases the borrowed pumpkin on unmount', () => {
    const { find, animate, stop } = setup(false);
    const { rerender, unmount } = render(<HalloweenTrain />);
    rerender(<HalloweenTrain />);
    expect(find).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledOnce();
    expect(stop).not.toHaveBeenCalled();
    unmount();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('keeps the wagon empty when no seasonal pumpkin is visible', () => {
    const { find, animate } = setup(false);
    find.mockReturnValue(null);
    render(<HalloweenTrain />);
    expect(animate).toHaveBeenCalledOnce();
    expect(animate.mock.calls[0][0].passenger).toBeUndefined();
    expect(animate.mock.calls[0][1].source).toBeNull();
  });

  it('falls back to static artwork when browser animation support is absent', () => {
    const { find, animate } = setup(false);
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value: undefined,
    });
    render(<HalloweenTrain />);
    expect(screen.getByLabelText('Empty ghost train')).toBeTruthy();
    expect(find).not.toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();
  });
});
