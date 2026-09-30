import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as mummy from '../../../utils/halloween-mummy';
import HalloweenMummy from '../HalloweenMummy';

const environment = vi.hoisted(() => ({ isMobile: false }));

vi.mock(
  '../../../../context/CelebrationEnvironmentContext',
  async (importOriginal) => {
    const { testAnchors, testEnvironment } =
      await import('../../../../test-utils/environment');
    /* One anchors object for the whole file, as the provider memoizes it. */
    const anchors = testAnchors({ composer: 'dial-ci-wrapper' });
    return {
      ...(await importOriginal<
        typeof import('../../../../context/CelebrationEnvironmentContext')
      >()),
      useCelebrationEnvironment: () =>
        testEnvironment({ isMobile: environment.isMobile, anchors }),
    };
  },
);

describe('mummy motion lifecycle', () => {
  beforeEach(() => {
    environment.isMobile = false;
  });
  const originalAnimate = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'animate',
  );
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalAnimate)
      Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
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
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: vi.fn(),
    });
    const target = {
      element: document.createElement('div'),
      rect: new DOMRect(300, 300, 700, 140),
    };
    const find = vi
      .spyOn(mummy, 'getMummyComposerTarget')
      .mockReturnValue(target);
    const stop = vi.fn();
    const animate = vi.spyOn(mummy, 'animateMummyPush').mockReturnValue(stop);
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
  it('leaves the composer alone when reduced motion is enabled', () => {
    const { animate } = setup(true);
    render(<HalloweenMummy />);
    expect(animate).not.toHaveBeenCalled();
  });
  it('restores the input if reduced motion is enabled during a push', async () => {
    const { animate, stop, reduce } = setup(false);
    render(<HalloweenMummy />);
    await waitFor(() => expect(animate).toHaveBeenCalledOnce());
    reduce();
    expect(stop).toHaveBeenCalledOnce();
    await waitFor(() => expect(animate).toHaveBeenCalledOnce());
  });
  it('does not restart on rerender and restores on unmount', async () => {
    const { animate, stop } = setup(false);
    const { rerender, unmount } = render(<HalloweenMummy />);
    rerender(<HalloweenMummy />);
    await waitFor(() => expect(animate).toHaveBeenCalledOnce());
    expect(stop).not.toHaveBeenCalled();
    unmount();
    expect(stop).toHaveBeenCalledOnce();
  });
  it('falls back to artwork when the composer is unavailable', async () => {
    const { find, animate } = setup(false);
    find.mockReturnValue(null);
    render(<HalloweenMummy />);
    await waitFor(() => expect(find).toHaveBeenCalledOnce());
    expect(animate).not.toHaveBeenCalled();
  });

  it('measures only once after the mobile viewport settles', async () => {
    vi.useFakeTimers();
    environment.isMobile = true;
    const viewport = new EventTarget();
    vi.stubGlobal('visualViewport', viewport);
    const { find, animate } = setup(false);
    render(<HalloweenMummy />);
    await act(() => vi.advanceTimersByTimeAsync(40));
    window.dispatchEvent(new Event('resize'));
    await act(() => vi.advanceTimersByTimeAsync(80));
    viewport.dispatchEvent(new Event('resize'));
    viewport.dispatchEvent(new Event('scroll'));
    await act(() => vi.advanceTimersByTimeAsync(119));
    expect(find).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(find).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledOnce();
    viewport.dispatchEvent(new Event('resize'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(animate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds mobile preparation even when viewport events keep arriving', async () => {
    vi.useFakeTimers();
    environment.isMobile = true;
    const { animate } = setup(false);
    render(<HalloweenMummy />);
    for (let i = 0; i < 5; i++) {
      await act(() => vi.advanceTimersByTimeAsync(100));
      window.dispatchEvent(new Event('resize'));
    }
    expect(animate).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(animate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    'pointerdown',
    'keydown',
    'beforeinput',
    'input',
    'compositionstart',
    'focusin',
    'scroll',
    'visibilitychange',
  ])('does not start a deferred mobile push after %s', async (event) => {
    vi.useFakeTimers();
    environment.isMobile = true;
    const { find, animate } = setup(false);
    const { container } = render(<HalloweenMummy />);
    act(() => document.dispatchEvent(new Event(event)));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(find).not.toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();
    expect(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- Inert artwork has no accessible role.
      container.querySelector('svg')?.parentElement?.style.visibility,
    ).toBe('hidden');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('disposes mobile preparation on unmount without measuring', async () => {
    vi.useFakeTimers();
    environment.isMobile = true;
    const { find } = setup(false);
    const { unmount } = render(<HalloweenMummy />);
    unmount();
    window.dispatchEvent(new Event('resize'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(find).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('releases pending mobile preparation when reduced motion is enabled', async () => {
    vi.useFakeTimers();
    environment.isMobile = true;
    const { find, reduce } = setup(false);
    const { container } = render(<HalloweenMummy />);
    reduce();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(find).not.toHaveBeenCalled();
    expect(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- Inert artwork has no accessible role.
      container.querySelector('svg')?.parentElement?.style.visibility,
    ).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });
});
