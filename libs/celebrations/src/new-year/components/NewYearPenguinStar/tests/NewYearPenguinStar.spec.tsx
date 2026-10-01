/* Inert scene artwork has no accessible controls; inspect its player boundary. */
/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { AnimationConfigWithData, AnimationItem } from 'lottie-web';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadLottiePlayer,
  type LottiePlayer,
} from '../../../../utils/lottie-player';
import { getPenguinStarTargets } from '../../../utils/penguin-star-targets';
import NewYearPenguinStar from '../NewYearPenguinStar';

const state = vi.hoisted(() => ({ mobile: false, reduced: false }));
vi.mock('../../../../context/CelebrationEnvironmentContext', async () => {
  const { testEnvironment } =
    await import('../../../../test-utils/environment');
  const anchors = { composer: 'gift-composer' };
  return {
    useCelebrationEnvironment: () =>
      testEnvironment({ anchors, isMobile: state.mobile }),
  };
});
vi.mock('../../../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => state.reduced,
}));
vi.mock('../../../utils/penguin-star-targets', () => ({
  getPenguinStarTargets: vi.fn(),
}));
vi.mock('../../../../utils/lottie-player', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../utils/lottie-player')>()),
  loadLottiePlayer: vi.fn(),
}));

const animations: {
  destroy: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  setSubframe: ReturnType<typeof vi.fn>;
  isLoaded: boolean;
  currentFrame: number;
  callbacks: Map<string, () => void>;
}[] = [];
const player = {
  loadAnimation:
    vi.fn<(options: AnimationConfigWithData<'svg'>) => AnimationItem>(),
};
const disconnect = vi.fn();
let onResize: () => void;
let fixture: HTMLDivElement;
let sourceRect: DOMRect;
let rendererReady: boolean;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  state.mobile = false;
  state.reduced = false;
  animations.length = 0;
  rendererReady = true;
  sourceRect = new DOMRect(400, 350, 560, 100);
  fixture = document.createElement('div');
  fixture.innerHTML = '<textarea aria-label="Draft">Private draft</textarea>';
  document.body.append(fixture);
  vi.spyOn(fixture, 'getBoundingClientRect').mockImplementation(
    () => sourceRect,
  );
  vi.mocked(getPenguinStarTargets).mockReturnValue({
    width: 1280,
    height: 900,
    rtl: false,
    box: { left: 400, top: 350, width: 560, height: 100 },
    source: { element: fixture, rect: sourceRect },
    heading: null,
    center: 780,
    throwCenter: 500,
    modelSelector: null,
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        onResize = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  player.loadAnimation.mockReset().mockImplementation(({ container }) => {
    const callbacks = new Map<string, () => void>();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    container.append(svg);
    const animation = {
      callbacks,
      isLoaded: rendererReady,
      currentFrame: 0,
      destroy: vi.fn(() => svg.remove()),
      play: vi.fn(),
      setSubframe: vi.fn(),
      addEventListener: vi.fn((name: string, callback: () => void) => {
        callbacks.set(name, callback);
      }),
      removeEventListener: vi.fn((name: string) => callbacks.delete(name)),
    };
    animations.push(animation);
    queueMicrotask(() => {
      if (rendererReady) callbacks.get('DOMLoaded')?.();
    });
    return animation as unknown as AnimationItem;
  });
  vi.mocked(loadLottiePlayer).mockReset().mockResolvedValue(player);
});
afterEach(() => {
  fixture.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};
const expectReleased = () => {
  expect(animations.length).toBeGreaterThan(0);
  expect(animations.every((a) => a.destroy.mock.calls.length === 1)).toBe(true);
  expect(animations.every((a) => a.callbacks.size === 0)).toBe(true);
  expect(disconnect).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
};
const deferPlayer = () => {
  let resolve: (value: LottiePlayer) => void = () => undefined;
  vi.mocked(loadLottiePlayer).mockReturnValue(
    new Promise<LottiePlayer>((complete) => {
      resolve = complete;
    }),
  );
  return () => resolve(player);
};
const withModelSelector = () => {
  const selector = document.createElement('button');
  selector.textContent = 'Model';
  selector.style.transform = 'none';
  selector.style.color = 'rgb(12, 34, 56)';
  fixture.append(selector);
  const rect = new DOMRect(740, 380, 80, 40);
  const cancel = vi.fn();
  const animate = vi.fn<HTMLElement['animate']>(
    () => ({ cancel }) as unknown as Animation,
  );
  Object.defineProperty(selector, 'animate', {
    configurable: true,
    value: animate,
  });
  vi.mocked(getPenguinStarTargets).mockReturnValue({
    width: 1280,
    height: 900,
    rtl: false,
    box: { left: 400, top: 350, width: 560, height: 100 },
    source: { element: fixture, rect: sourceRect },
    heading: null,
    modelSelector: { element: selector, rect },
    borrowed: { element: selector, rect },
    center: 780,
    throwCenter: 500,
  });
  return { selector, animate, cancel };
};

describe('Penguin star Lottie lifecycle', () => {
  it.each(['complete', 'input', 'scroll', 'unmount'])(
    'restores the borrowed selector after %s',
    async (mode) => {
      const { selector, animate, cancel } = withModelSelector();
      const originalStyle = selector.getAttribute('style');
      const originalTransform = getComputedStyle(selector).transform;
      const view = render(<NewYearPenguinStar />);
      await flush();
      act(() => {
        animations[0].currentFrame = 5.1 * 60 - 1;
        animations[0].callbacks.get('enterFrame')?.();
      });
      expect(animate).not.toHaveBeenCalled();
      act(() => {
        animations[0].currentFrame = 5.1 * 60;
        animations[0].callbacks.get('enterFrame')?.();
        animations[0].callbacks.get('enterFrame')?.();
      });
      expect(animate).toHaveBeenCalledOnce();
      expect(animate).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ fill: 'forwards' }),
      );
      const options = animate.mock.calls[0][1] as KeyframeAnimationOptions;
      expect(options.duration).toBe(1600);
      expect(view.container.querySelector('foreignObject')).toBeNull();
      expect(selector.getAttribute('style')).toBe(originalStyle);
      if (mode === 'complete')
        act(() => animations[0].callbacks.get('complete')?.());
      if (mode === 'input')
        fireEvent.input(screen.getByRole('textbox', { name: 'Draft' }));
      if (mode === 'scroll')
        act(() => window.dispatchEvent(new Event('scroll')));
      if (mode === 'unmount') view.unmount();
      expect(cancel).toHaveBeenCalledOnce();
      expect(selector.getAttribute('style')).toBe(originalStyle);
      expect(getComputedStyle(selector).transform).toBe(originalTransform);
      expectReleased();
      view.unmount();
    },
  );

  it('does not animate a host control when no model selector qualifies', async () => {
    const button = document.createElement('button');
    button.textContent = 'Model';
    const animate = vi.fn();
    Object.defineProperty(button, 'animate', {
      configurable: true,
      value: animate,
    });
    fixture.append(button);
    const view = render(<NewYearPenguinStar />);
    await flush();
    act(() => {
      animations[0].currentFrame = 9 * 60;
      animations[0].callbacks.get('enterFrame')?.();
      animations[0].callbacks.get('complete')?.();
    });
    expect(animate).not.toHaveBeenCalled();
    expectReleased();
    view.unmount();
  });

  it.each(['input', 'complete', 'error'])(
    'never borrows or copies composer content when playback ends by %s',
    async (mode) => {
      const button = document.createElement('button');
      button.textContent = 'Model';
      fixture.append(button);
      const original = fixture.outerHTML;
      const view = render(<NewYearPenguinStar />);
      await flush();
      expect(view.container.querySelector('foreignObject')).toBeNull();
      expect(view.container.querySelector('textarea')).toBeNull();
      expect(fixture.outerHTML).toBe(original);
      if (mode === 'input')
        fireEvent.input(screen.getByRole('textbox', { name: 'Draft' }));
      else act(() => animations[0].callbacks.get(mode)?.());
      expect(screen.getByRole('button', { name: 'Model' })).toBe(button);
      expect(fixture.outerHTML).toBe(original);
      expectReleased();
      view.unmount();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each([false, true])(
    'plays one local composition without changing draft, focus or selection, mobile=%s',
    async (mobile) => {
      state.mobile = mobile;
      const input = screen.getByRole('textbox', {
        name: 'Draft',
      }) as HTMLTextAreaElement;
      input.focus();
      input.setSelectionRange(2, 7, 'backward');
      const before = fixture.outerHTML;
      const view = render(
        <StrictMode>
          <NewYearPenguinStar />
        </StrictMode>,
      );
      await flush();
      expect(loadLottiePlayer).toHaveBeenCalledOnce();
      expect(getPenguinStarTargets).toHaveBeenCalledOnce();
      expect(player.loadAnimation).toHaveBeenCalledOnce();
      expect(player.loadAnimation).toHaveBeenCalledWith(
        expect.objectContaining({
          container: view.container.querySelector('[data-new-year-scene]'),
          renderer: 'svg',
          loop: false,
          autoplay: false,
          animationData: expect.objectContaining({ fr: 60, op: 1200 }),
        }),
      );
      expect(animations[0].setSubframe).toHaveBeenCalledWith(true);
      expect(animations[0].play).toHaveBeenCalledOnce();
      expect(screen.queryByRole('img')).toBeNull();
      expect(document.activeElement).toBe(input);
      expect([
        input.value,
        input.selectionStart,
        input.selectionEnd,
        input.selectionDirection,
      ]).toEqual(['Private draft', 2, 7, 'backward']);
      expect(fixture.outerHTML).toBe(before);
      act(() => vi.advanceTimersByTime(20000));
      expectReleased();
      expect(view.container.querySelector('[data-new-year-scene]')).toBeNull();
      expect(fixture.outerHTML).toBe(before);
      view.unmount();
      expect(animations[0].destroy).toHaveBeenCalledOnce();
    },
  );

  it.each([
    'pointerdown',
    'click',
    'keydown',
    'focusin',
    'focusout',
    'beforeinput',
    'input',
    'compositionstart',
    'scroll',
    'resize',
    'visibilitychange',
  ])('destroys playback immediately on %s', async (name) => {
    const view = render(<NewYearPenguinStar />);
    await flush();
    if (name === 'visibilitychange')
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => window.dispatchEvent(new Event(name)));
    expectReleased();
    expect(view.container.querySelector('[data-new-year-scene]')).toBeNull();
    view.unmount();
  });

  it.each(['complete', 'data_failed', 'error'])(
    'releases the player once after its %s event',
    async (name) => {
      const view = render(<NewYearPenguinStar />);
      await flush();
      act(() => animations[0].callbacks.get(name)?.());
      expectReleased();
      if (name !== 'complete') {
        const fallback = view.container.querySelector('[data-penguin-static]');
        expect(fallback).not.toBeNull();
        expect(fallback?.parentElement?.style.visibility).not.toBe('hidden');
      }
      view.unmount();
      act(() => vi.advanceTimersByTime(23000));
      expect(animations[0].destroy).toHaveBeenCalledOnce();
    },
  );

  it.each(['reduced', 'noResizeObserver', 'noMutationObserver'])(
    'does not load the player or measure the host for %s',
    async (mode) => {
      state.reduced = mode === 'reduced';
      if (mode === 'noResizeObserver')
        vi.stubGlobal('ResizeObserver', undefined);
      if (mode === 'noMutationObserver')
        vi.stubGlobal('MutationObserver', undefined);
      const view = render(<NewYearPenguinStar />);
      await flush();
      expect(loadLottiePlayer).not.toHaveBeenCalled();
      expect(getPenguinStarTargets).not.toHaveBeenCalled();
      expect(player.loadAnimation).not.toHaveBeenCalled();
      expect(
        view.container.querySelector('[data-penguin-static]'),
      ).not.toBeNull();

      view.unmount();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('shows static art when the engine import fails', async () => {
    vi.mocked(loadLottiePlayer).mockRejectedValue(new Error('Load failed'));
    const view = render(<NewYearPenguinStar />);
    await flush();
    expect(
      view.container.querySelector('[data-penguin-static]'),
    ).not.toBeNull();
    expect(getPenguinStarTargets).not.toHaveBeenCalled();
    expect(player.loadAnimation).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    view.unmount();
  });

  it('falls back after two seconds and ignores a late player import', async () => {
    const resolve = deferPlayer();
    const view = render(<NewYearPenguinStar />);
    await flush();
    expect(getPenguinStarTargets).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2000));
    expect(
      view.container.querySelector('[data-penguin-static]'),
    ).not.toBeNull();
    await act(async () => resolve());
    expect(getPenguinStarTargets).not.toHaveBeenCalled();
    expect(player.loadAnimation).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    view.unmount();
  });

  it('measures the composer and nearby scene sources only after the player is ready', async () => {
    const resolve = deferPlayer();
    const view = render(<NewYearPenguinStar />);
    await flush();
    expect(getPenguinStarTargets).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1900));
    await act(async () => resolve());
    expect(getPenguinStarTargets).toHaveBeenCalledOnce();
    expect(player.loadAnimation).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(20000));
    expectReleased();
    view.unmount();
  });

  it.each(['typing', 'unmount', 'reduced', 'hidden'])(
    'never starts a pending import after %s',
    async (mode) => {
      const resolve = deferPlayer();
      const view = render(<NewYearPenguinStar />);
      await flush();
      if (mode === 'typing')
        fireEvent.input(screen.getByRole('textbox', { name: 'Draft' }));
      if (mode === 'unmount') view.unmount();
      if (mode === 'reduced') {
        state.reduced = true;
        view.rerender(<NewYearPenguinStar />);
      }
      if (mode === 'hidden') {
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        act(() => window.dispatchEvent(new Event('visibilitychange')));
      }
      await act(async () => resolve());
      expect(getPenguinStarTargets).not.toHaveBeenCalled();
      expect(player.loadAnimation).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      view.unmount();
    },
  );

  it.each(['typing', 'unmount'])(
    'cancels before preparation on %s',
    async (mode) => {
      const view = render(<NewYearPenguinStar />);
      if (mode === 'typing')
        fireEvent.input(screen.getByRole('textbox', { name: 'Draft' }));
      else view.unmount();
      await flush();
      expect(loadLottiePlayer).not.toHaveBeenCalled();
      expect(getPenguinStarTargets).not.toHaveBeenCalled();
      expect(player.loadAnimation).not.toHaveBeenCalled();
      view.unmount();
    },
  );

  it.each(['resize', 'mutation', 'remove', 'reduced', 'mobile'])(
    'releases playback when the source or environment changes: %s',
    async (mode) => {
      const view = render(<NewYearPenguinStar />);
      await flush();
      if (mode === 'resize')
        act(() => {
          sourceRect = new DOMRect(400, 380, 560, 100);
          onResize();
        });
      if (mode === 'mutation') {
        fixture.style.display = 'none';
        await flush();
      }
      if (mode === 'remove') {
        fixture.remove();
        await flush();
      }
      if (mode === 'reduced') {
        state.reduced = true;
        view.rerender(<NewYearPenguinStar />);
      }
      if (mode === 'mobile') {
        state.mobile = true;
        view.rerender(<NewYearPenguinStar />);
      }
      expectReleased();
      expect(view.container.querySelector('[data-new-year-scene]')).toBeNull();
      view.unmount();
    },
  );

  it.each(['heading', 'starters'])(
    'stops without modifying the measured %s when its geometry changes',
    async (kind) => {
      const element = document.createElement(kind === 'heading' ? 'h1' : 'div');
      element.textContent = kind;
      document.body.append(element);
      let rect = new DOMRect(200, 160, 180, 40);
      vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => rect);
      vi.mocked(getPenguinStarTargets).mockReturnValue({
        width: 1280,
        height: 900,
        rtl: false,
        box: { left: 400, top: 350, width: 560, height: 100 },
        source: { element: fixture, rect: sourceRect },
        heading: kind === 'heading' ? { element, rect } : null,
        starters: kind === 'starters' ? { element, rect } : null,
        center: 780,
        throwCenter: 500,
        modelSelector: null,
      });
      const original = element.outerHTML;
      const view = render(<NewYearPenguinStar />);
      await flush();
      expect(element.outerHTML).toBe(original);
      act(() => {
        rect = new DOMRect(210, 160, 180, 40);
        onResize();
      });
      expectReleased();
      expect(element.outerHTML).toBe(original);
      view.unmount();
      element.remove();
    },
  );

  it('cleans resources when player startup throws', async () => {
    const load = player.loadAnimation.getMockImplementation();
    if (!load) throw new Error('Missing player fixture');
    player.loadAnimation.mockImplementationOnce((options) => {
      const animation = load(options);
      vi.mocked(animation.play).mockImplementationOnce(() => {
        throw new Error('Playback unavailable');
      });
      return animation;
    });
    const view = render(<NewYearPenguinStar />);
    await flush();
    expectReleased();
    expect(view.container.querySelector('[data-new-year-scene]')).toBeNull();
    expect(
      view.container.querySelector('[data-penguin-static]'),
    ).not.toBeNull();
    view.unmount();
  });

  it('shows the static pair when the player cannot create an animation', async () => {
    player.loadAnimation.mockImplementationOnce(() => {
      throw new Error('Renderer unavailable');
    });
    const view = render(<NewYearPenguinStar />);
    await flush();
    expect(
      view.container.querySelector('[data-penguin-static]'),
    ).not.toBeNull();
    expect(view.container.querySelector('[data-new-year-scene]')).toBeNull();
    expect(animations).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    view.unmount();
  });

  it('falls back when a returned player never finishes renderer initialization', async () => {
    rendererReady = false;
    const view = render(<NewYearPenguinStar />);
    await flush();
    expect(animations[0].play).not.toHaveBeenCalled();
    /* The engine can set isLoaded before throwing internally in initItems;
       only the subsequent DOMLoaded event proves that rendering succeeded. */
    animations[0].isLoaded = true;
    act(() => vi.advanceTimersByTime(250));
    expectReleased();
    expect(
      view.container.querySelector('[data-penguin-static]'),
    ).not.toBeNull();
    expect(animations[0].play).not.toHaveBeenCalled();
    view.unmount();
  });

  it('starts the complete playback deadline only after renderer readiness', async () => {
    rendererReady = false;
    const view = render(<NewYearPenguinStar />);
    await flush();
    act(() => vi.advanceTimersByTime(200));
    expect(animations[0].play).not.toHaveBeenCalled();
    act(() => {
      animations[0].isLoaded = true;
      animations[0].callbacks.get('DOMLoaded')?.();
    });
    expect(animations[0].play).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(19900));
    expect(animations[0].destroy).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
    expectReleased();
    view.unmount();
  });

  it('still releases observers and timers if player destruction throws', async () => {
    const view = render(<NewYearPenguinStar />);
    await flush();
    animations[0].destroy.mockImplementationOnce(() => {
      throw new Error('Renderer teardown failed');
    });
    act(() => animations[0].callbacks.get('error')?.());
    expectReleased();
    expect(
      view.container.querySelector('[data-penguin-static]'),
    ).not.toBeNull();
    view.unmount();
  });

  it('leaves no player or timers after repeated mounts and interrupts', async () => {
    for (let i = 0; i < 4; i++) {
      const view = render(<NewYearPenguinStar />);
      await flush();
      fireEvent.input(screen.getByRole('textbox', { name: 'Draft' }));
      view.unmount();
    }
    expect(disconnect).toHaveBeenCalledTimes(4);
    expect(animations).toHaveLength(4);
    expect(animations.every((a) => a.destroy.mock.calls.length === 1)).toBe(
      true,
    );
    expect(animations.every((a) => a.callbacks.size === 0)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('plays the parcel fallback and cancels on visual viewport changes', async () => {
    const viewport = new EventTarget();
    vi.stubGlobal('visualViewport', viewport);
    vi.mocked(getPenguinStarTargets).mockReturnValue({
      width: 360,
      height: 800,
      rtl: false,
      box: { left: 55, top: 450, width: 250, height: 66 },
      source: null,
      heading: null,
      center: 262,
      throwCenter: 98,
      modelSelector: null,
    });
    const view = render(<NewYearPenguinStar />);
    await flush();
    expect(
      view.container.querySelector('[data-penguin-target="snow"]'),
    ).not.toBeNull();
    expect(animations).toHaveLength(1);
    act(() => viewport.dispatchEvent(new Event('resize')));
    expect(view.container.querySelector('[data-new-year-scene]')).toBeNull();
    expect(animations[0].destroy).toHaveBeenCalledOnce();
    expect(disconnect).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    view.unmount();
  });

  it('ignores generated SVG mutations without reading layout during playback', async () => {
    const view = render(<NewYearPenguinStar />);
    await flush();
    const scene = view.container.querySelector('[data-new-year-scene]');
    const svg = scene?.querySelector('svg');
    if (!scene || !svg) throw new Error('Missing scene');
    const reads = vi.mocked(fixture.getBoundingClientRect).mock.calls.length;
    svg.style.transform = 'translate(1px, 0)';
    svg.append(document.createElementNS('http://www.w3.org/2000/svg', 'path'));
    await flush();
    act(() => vi.advanceTimersByTime(8000));
    expect(vi.mocked(fixture.getBoundingClientRect).mock.calls.length).toBe(
      reads,
    );
    expect(animations[0].destroy).not.toHaveBeenCalled();
    sourceRect = new DOMRect(400, 380, 560, 100);
    const sibling = document.createElement('div');
    document.body.append(sibling);
    await flush();
    expectReleased();
    sibling.remove();
    view.unmount();
  });
});
