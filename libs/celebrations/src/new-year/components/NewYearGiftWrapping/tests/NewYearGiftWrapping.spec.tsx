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
import { getGiftWrappingTarget } from '../../../utils/gift-wrapping-targets';
import NewYearGiftWrapping from '../NewYearGiftWrapping';

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
vi.mock('../../../utils/gift-wrapping-targets', () => ({
  getGiftWrappingTarget: vi.fn(),
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
  vi.mocked(getGiftWrappingTarget).mockReturnValue({
    width: 1280,
    height: 900,
    rtl: false,
    box: { left: 400, top: 350, width: 560, height: 100 },
    source: { element: fixture, rect: sourceRect },
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

describe('Gift wrapping Lottie lifecycle', () => {
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
          <NewYearGiftWrapping />
        </StrictMode>,
      );
      await flush();
      expect(loadLottiePlayer).toHaveBeenCalledOnce();
      expect(getGiftWrappingTarget).toHaveBeenCalledOnce();
      expect(player.loadAnimation).toHaveBeenCalledOnce();
      expect(player.loadAnimation).toHaveBeenCalledWith(
        expect.objectContaining({
          container: view.container.querySelector('[data-new-year-scene]'),
          renderer: 'svg',
          loop: false,
          autoplay: false,
          animationData: expect.objectContaining({ fr: 60 }),
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
      act(() => vi.advanceTimersByTime(16000));
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
    const view = render(<NewYearGiftWrapping />);
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
      const view = render(<NewYearGiftWrapping />);
      await flush();
      act(() => animations[0].callbacks.get(name)?.());
      expectReleased();
      if (name !== 'complete') {
        const fallback = view.container.querySelector('[data-gift-static]');
        expect(fallback).not.toBeNull();
        expect(fallback?.parentElement?.style.visibility).not.toBe('hidden');
      }
      view.unmount();
      act(() => vi.advanceTimersByTime(18000));
      expect(animations[0].destroy).toHaveBeenCalledOnce();
    },
  );

  it.each(['reduced', 'noResizeObserver', 'noMutationObserver'])(
    'does not load the player or measure host controls for %s',
    async (mode) => {
      state.reduced = mode === 'reduced';
      if (mode === 'noResizeObserver')
        vi.stubGlobal('ResizeObserver', undefined);
      if (mode === 'noMutationObserver')
        vi.stubGlobal('MutationObserver', undefined);
      const view = render(<NewYearGiftWrapping />);
      await flush();
      expect(loadLottiePlayer).not.toHaveBeenCalled();
      expect(getGiftWrappingTarget).not.toHaveBeenCalled();
      expect(player.loadAnimation).not.toHaveBeenCalled();
      expect(view.container.querySelector('[data-gift-static]')).not.toBeNull();
      expect(view.container.querySelectorAll('[data-elf-art]')).toHaveLength(2);
      view.unmount();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('shows static art when the engine import fails', async () => {
    vi.mocked(loadLottiePlayer).mockRejectedValue(new Error('Load failed'));
    const view = render(<NewYearGiftWrapping />);
    await flush();
    expect(view.container.querySelector('[data-gift-static]')).not.toBeNull();
    expect(getGiftWrappingTarget).not.toHaveBeenCalled();
    expect(player.loadAnimation).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    view.unmount();
  });

  it('falls back after two seconds and ignores a late player import', async () => {
    const resolve = deferPlayer();
    const view = render(<NewYearGiftWrapping />);
    await flush();
    expect(getGiftWrappingTarget).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2000));
    expect(view.container.querySelector('[data-gift-static]')).not.toBeNull();
    await act(async () => resolve());
    expect(getGiftWrappingTarget).not.toHaveBeenCalled();
    expect(player.loadAnimation).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    view.unmount();
  });

  it('measures the current composer only after the player is ready', async () => {
    const resolve = deferPlayer();
    const view = render(<NewYearGiftWrapping />);
    await flush();
    expect(getGiftWrappingTarget).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1900));
    await act(async () => resolve());
    expect(getGiftWrappingTarget).toHaveBeenCalledOnce();
    expect(player.loadAnimation).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(16000));
    expectReleased();
    view.unmount();
  });

  it.each(['typing', 'unmount', 'reduced', 'hidden'])(
    'never starts a pending import after %s',
    async (mode) => {
      const resolve = deferPlayer();
      const view = render(<NewYearGiftWrapping />);
      await flush();
      if (mode === 'typing')
        fireEvent.input(screen.getByRole('textbox', { name: 'Draft' }));
      if (mode === 'unmount') view.unmount();
      if (mode === 'reduced') {
        state.reduced = true;
        view.rerender(<NewYearGiftWrapping />);
      }
      if (mode === 'hidden') {
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        act(() => window.dispatchEvent(new Event('visibilitychange')));
      }
      await act(async () => resolve());
      expect(getGiftWrappingTarget).not.toHaveBeenCalled();
      expect(player.loadAnimation).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      view.unmount();
    },
  );

  it.each(['typing', 'unmount'])(
    'cancels before preparation on %s',
    async (mode) => {
      const view = render(<NewYearGiftWrapping />);
      if (mode === 'typing')
        fireEvent.input(screen.getByRole('textbox', { name: 'Draft' }));
      else view.unmount();
      await flush();
      expect(loadLottiePlayer).not.toHaveBeenCalled();
      expect(getGiftWrappingTarget).not.toHaveBeenCalled();
      expect(player.loadAnimation).not.toHaveBeenCalled();
      view.unmount();
    },
  );

  it.each(['resize', 'mutation', 'remove', 'reduced', 'mobile'])(
    'releases playback when the source or environment changes: %s',
    async (mode) => {
      const view = render(<NewYearGiftWrapping />);
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
        view.rerender(<NewYearGiftWrapping />);
      }
      if (mode === 'mobile') {
        state.mobile = true;
        view.rerender(<NewYearGiftWrapping />);
      }
      expectReleased();
      expect(view.container.querySelector('[data-new-year-scene]')).toBeNull();
      view.unmount();
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
    const view = render(<NewYearGiftWrapping />);
    await flush();
    expectReleased();
    expect(view.container.querySelector('[data-new-year-scene]')).toBeNull();
    expect(view.container.querySelector('[data-gift-static]')).not.toBeNull();
    view.unmount();
  });

  it('shows the static pair when the player cannot create an animation', async () => {
    player.loadAnimation.mockImplementationOnce(() => {
      throw new Error('Renderer unavailable');
    });
    const view = render(<NewYearGiftWrapping />);
    await flush();
    expect(view.container.querySelector('[data-gift-static]')).not.toBeNull();
    expect(view.container.querySelector('[data-new-year-scene]')).toBeNull();
    expect(animations).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    view.unmount();
  });

  it('falls back when a returned player never finishes renderer initialization', async () => {
    rendererReady = false;
    const view = render(<NewYearGiftWrapping />);
    await flush();
    expect(animations[0].play).not.toHaveBeenCalled();
    /* The engine can set isLoaded before throwing internally in initItems;
       only the subsequent DOMLoaded event proves that rendering succeeded. */
    animations[0].isLoaded = true;
    act(() => vi.advanceTimersByTime(250));
    expectReleased();
    expect(view.container.querySelector('[data-gift-static]')).not.toBeNull();
    expect(animations[0].play).not.toHaveBeenCalled();
    view.unmount();
  });

  it('starts the complete playback deadline only after renderer readiness', async () => {
    rendererReady = false;
    const view = render(<NewYearGiftWrapping />);
    await flush();
    act(() => vi.advanceTimersByTime(200));
    expect(animations[0].play).not.toHaveBeenCalled();
    act(() => {
      animations[0].isLoaded = true;
      animations[0].callbacks.get('DOMLoaded')?.();
    });
    expect(animations[0].play).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(15900));
    expect(animations[0].destroy).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
    expectReleased();
    view.unmount();
  });

  it('still releases observers and timers if player destruction throws', async () => {
    const view = render(<NewYearGiftWrapping />);
    await flush();
    animations[0].destroy.mockImplementationOnce(() => {
      throw new Error('Renderer teardown failed');
    });
    act(() => animations[0].callbacks.get('error')?.());
    expectReleased();
    expect(view.container.querySelector('[data-gift-static]')).not.toBeNull();
    view.unmount();
  });

  it('leaves no player or timers after repeated mounts and interrupts', async () => {
    for (let i = 0; i < 4; i++) {
      const view = render(<NewYearGiftWrapping />);
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
    vi.mocked(getGiftWrappingTarget).mockReturnValue({
      width: 360,
      height: 800,
      rtl: false,
      box: { left: 55, top: 450, width: 250, height: 66 },
      source: null,
    });
    const view = render(<NewYearGiftWrapping />);
    await flush();
    expect(
      view.container.querySelector('[data-gift-target="parcel"]'),
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
    const view = render(<NewYearGiftWrapping />);
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

  it('interrupting renderer initialization destroys the renderer once and ignores a late DOMLoaded', async () => {
    rendererReady = false;
    const view = render(<NewYearGiftWrapping />);
    await flush();
    const domLoaded = animations[0].callbacks.get('DOMLoaded');
    expect(domLoaded).toBeDefined();
    act(() => window.dispatchEvent(new Event('pointerdown')));
    expectReleased();
    animations[0].isLoaded = true;
    act(() => domLoaded?.());
    expect(animations[0].play).not.toHaveBeenCalled();
    expect(animations[0].destroy).toHaveBeenCalledOnce();
    expect(view.container.querySelector('[data-new-year-scene]')).toBeNull();
    expect(view.container.querySelector('[data-gift-static]')).toBeNull();
    view.unmount();
  });

  it('disconnects the composer MutationObserver when the ResizeObserver cannot be created', async () => {
    const mutationDisconnect = vi.spyOn(
      MutationObserver.prototype,
      'disconnect',
    );
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor() {
          throw new Error('ResizeObserver unavailable');
        }
      },
    );
    const view = render(<NewYearGiftWrapping />);
    await flush();
    expect(mutationDisconnect).toHaveBeenCalledOnce();
    expect(animations[0].destroy).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    expect(view.container.querySelector('[data-gift-static]')).not.toBeNull();
    view.unmount();
  });

  it('a second activation renders a newly built composition', async () => {
    const { unmount: unmountFirst } = render(<NewYearGiftWrapping />);
    await flush();
    const firstData = player.loadAnimation.mock.calls[0][0].animationData as {
      layers: unknown[];
    };
    /* Simulate the player consuming its input in place. */
    firstData.layers.length = 0;
    unmountFirst();
    const view = render(<NewYearGiftWrapping />);
    await flush();
    const secondData = player.loadAnimation.mock.calls[1][0].animationData as {
      layers: unknown[];
    };
    expect(secondData).not.toBe(firstData);
    expect(secondData.layers.length).toBeGreaterThan(0);
    expect(animations[1].play).toHaveBeenCalledOnce();
    view.unmount();
  });
});
