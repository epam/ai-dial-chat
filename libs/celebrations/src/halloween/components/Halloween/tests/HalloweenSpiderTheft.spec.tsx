import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as theft from '../../../utils/halloween-spider-theft';
import HalloweenSpiderTheft from '../HalloweenSpiderTheft';

vi.mock(
  '../../../../context/CelebrationEnvironmentContext',
  async (importOriginal) => {
    const { testAnchors, testEnvironment } =
      await import('../../../../test-utils/environment');
    /* One anchors object for the whole file, as the provider memoizes it. */
    const anchors = testAnchors({
      composer: 'wrapper',
      composerModelSelector: 'model',
      composerAddCluster: 'attach',
    });
    return {
      ...(await importOriginal<
        typeof import('../../../../context/CelebrationEnvironmentContext')
      >()),
      useCelebrationEnvironment: () =>
        testEnvironment({ isMobile: false, anchors }),
    };
  },
);

describe('spider theft lifecycle', () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    'animate',
  );
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (descriptor)
      Object.defineProperty(Element.prototype, 'animate', descriptor);
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
    const find = vi.spyOn(theft, 'getSpiderTheftTargets').mockReturnValue([
      {
        element: document.createElement('h1'),
        rect: new DOMRect(300, 200, 320, 40),
      },
    ]);
    const stop = vi.fn();
    const animate = vi.spyOn(theft, 'animateSpiderTheft').mockReturnValue(stop);
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
  it('keeps the same carriers on rerender and restores on unmount', async () => {
    const { animate, stop } = setup(false);
    const { rerender, unmount } = render(<HalloweenSpiderTheft />);
    await waitFor(() => expect(animate).toHaveBeenCalledOnce());
    rerender(<HalloweenSpiderTheft />);
    expect(animate).toHaveBeenCalledOnce();
    unmount();
    expect(stop).toHaveBeenCalledOnce();
  });
  it('drops the borrowing immediately when reduced motion is enabled', async () => {
    const { animate, stop, reduce } = setup(false);
    render(<HalloweenSpiderTheft />);
    await waitFor(() => expect(animate).toHaveBeenCalledOnce());
    reduce();
    expect(stop).toHaveBeenCalledOnce();
  });
  it('never borrows in reduced motion', () => {
    const { animate, find } = setup(true);
    render(<HalloweenSpiderTheft />);
    expect(animate).not.toHaveBeenCalled();
    expect(find).not.toHaveBeenCalled();
  });
});
