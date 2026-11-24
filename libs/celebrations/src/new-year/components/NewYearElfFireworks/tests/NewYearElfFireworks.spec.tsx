/* Inert scene artwork has no accessible controls; inspect its player boundary. */
/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import { act, render, screen } from '@testing-library/react';
import type { AnimationConfigWithData, AnimationItem } from 'lottie-web';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubAnimate } from '../../../../test-utils/snowman-fixtures';
import { animateCelebrationSnapshots } from '../../../../utils/celebration-snapshots';
import { loadLottiePlayer } from '../../../../utils/lottie-player';
import { ElfFireworksMode } from '../../../types/new-year';
import { ELF_FIREWORKS_MS } from '../../../utils/elf-fireworks-composition';
import NewYearElfFireworks from '../NewYearElfFireworks';

const state = vi.hoisted(() => ({ mobile: false, reduced: false }));
vi.mock('../../../../context/CelebrationEnvironmentContext', async () => {
  const { testEnvironment } =
    await import('../../../../test-utils/environment');
  const anchors = { composer: 'elf-composer' };
  return {
    useCelebrationEnvironment: () =>
      testEnvironment({ anchors, isMobile: state.mobile }),
  };
});
vi.mock('../../../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => state.reduced,
}));
vi.mock('../../../../utils/lottie-player', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../utils/lottie-player')>()),
  loadLottiePlayer: vi.fn(),
}));
vi.mock('../../../../utils/celebration-snapshots', () => ({
  animateCelebrationSnapshots: vi.fn(),
}));

interface FakeAnimation {
  destroy: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  callbacks: Map<string, () => void>;
  currentFrame: number;
}

const animations: FakeAnimation[] = [];
const player = {
  loadAnimation:
    vi.fn<(options: AnimationConfigWithData<'svg'>) => AnimationItem>(),
};
const stopButton = vi.fn();
let send: HTMLButtonElement;
let draft: HTMLTextAreaElement;

const place = (element: Element, rect: DOMRect) =>
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => rect,
  });
const viewport = (width: number, height: number) => {
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    get: () => width,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    get: () => height,
  });
};
/** A composer with a draft and a send button at its inline end. */
const buildComposer = (top = 420) => {
  viewport(1280, 900);
  document.body.innerHTML =
    '<div class="elf-composer"><textarea aria-label="Draft">Private draft</textarea><button>Send</button></div>';
  const composer = document.querySelector('.elf-composer') as HTMLElement;
  place(composer, new DOMRect(360, top, 560, 68));
  draft = screen.getByRole('textbox', {
    name: 'Draft',
  }) as HTMLTextAreaElement;
  send = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
  place(send, new DOMRect(864, top + 12, 44, 44));
};

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 4; i++) await Promise.resolve();
  });
};
const firstFrame = (frame = 0) =>
  act(() => {
    const latest = animations[animations.length - 1];
    latest.currentFrame = frame;
    latest.callbacks.get('enterFrame')?.();
  });
const expectReleased = () => {
  expect(animations.every((a) => a.destroy.mock.calls.length === 1)).toBe(true);
  expect(animations.every((a) => a.callbacks.size === 0)).toBe(true);
  expect(document.querySelector('[data-elf-button-layer]')).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
};

describe('NewYearElfFireworks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    stubAnimate();
    state.mobile = false;
    state.reduced = false;
    animations.length = 0;
    buildComposer();
    vi.mocked(animateCelebrationSnapshots).mockReturnValue(stopButton);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    player.loadAnimation.mockReset().mockImplementation(({ container }) => {
      const callbacks = new Map<string, () => void>();
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      container.append(svg);
      const animation: FakeAnimation = {
        callbacks,
        currentFrame: 0,
        destroy: vi.fn(() => svg.remove()),
        play: vi.fn(),
      };
      animations.push(animation);
      queueMicrotask(() => callbacks.get('DOMLoaded')?.());
      return {
        ...animation,
        isLoaded: true,
        frameRate: 60,
        get currentFrame() {
          return animation.currentFrame;
        },
        setSubframe: vi.fn(),
        addEventListener: vi.fn((name: string, callback: () => void) =>
          callbacks.set(name, callback),
        ),
        removeEventListener: vi.fn((name: string) => callbacks.delete(name)),
      } as unknown as AnimationItem;
    });
    vi.mocked(loadLottiePlayer).mockReset().mockResolvedValue(player);
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.each([false, true])(
    'plays one composition and starts the send button copy on its first frame, mobile=%s',
    async (mobile) => {
      state.mobile = mobile;
      const before = send.outerHTML;
      const view = render(
        <StrictMode>
          <NewYearElfFireworks />
        </StrictMode>,
      );
      await flush();

      expect(loadLottiePlayer).toHaveBeenCalledOnce();
      expect(player.loadAnimation).toHaveBeenCalledOnce();
      expect(animations[0].play).toHaveBeenCalledOnce();
      const host = view.container.querySelector('[data-new-year-scene]');
      expect(host?.getAttribute('data-elf-fireworks-mode')).toBe(
        ElfFireworksMode.Button,
      );
      expect(host?.getAttribute('aria-hidden')).toBe('true');
      expect(
        host?.firstElementChild?.hasAttribute('data-elf-button-layer'),
      ).toBe(true);
      expect(animateCelebrationSnapshots).not.toHaveBeenCalled();

      vi.spyOn(performance, 'now').mockReturnValue(1000);
      firstFrame(3);

      expect(animateCelebrationSnapshots).toHaveBeenCalledOnce();
      const [borrowed, layer, options] = vi.mocked(animateCelebrationSnapshots)
        .mock.calls[0];
      expect(borrowed).toEqual([expect.objectContaining({ element: send })]);
      expect((layer as HTMLElement).hasAttribute('data-elf-button-layer')).toBe(
        true,
      );
      expect(options).toMatchObject({
        durationMs: ELF_FIREWORKS_MS,
        startTime: 950,
      });
      expect(draft.value).toBe('Private draft');
      expect(send.outerHTML).toBe(before);

      act(() => vi.advanceTimersByTime(ELF_FIREWORKS_MS));
      expectReleased();
      expect(stopButton).toHaveBeenCalledOnce();
      expect(view.container.querySelector('[data-new-year-scene]')).toBeNull();
      view.unmount();
    },
  );

  it('plays with a drawn detonator and borrows nothing without an eligible send button', async () => {
    send.remove();
    const view = render(<NewYearElfFireworks />);
    await flush();
    firstFrame();

    const host = view.container.querySelector('[data-new-year-scene]');
    expect(host?.getAttribute('data-elf-fireworks-mode')).toBe(
      ElfFireworksMode.Detonator,
    );
    expect(document.querySelector('[data-elf-button-layer]')).toBeNull();
    expect(animateCelebrationSnapshots).not.toHaveBeenCalled();
    view.unmount();
  });

  it.each(['pointerdown', 'keydown', 'focusin', 'input', 'scroll', 'resize'])(
    'ends at once and releases the button copy on %s',
    async (name) => {
      const view = render(<NewYearElfFireworks />);
      await flush();
      firstFrame();

      act(() => window.dispatchEvent(new Event(name)));

      expectReleased();
      expect(stopButton).toHaveBeenCalledOnce();
      expect(view.container.querySelector('[data-new-year-scene]')).toBeNull();
      expect(
        view.container.querySelector('[data-elf-fireworks-static]'),
      ).toBeNull();
      view.unmount();
    },
  );

  it('cancels when the snapshot helper reports an interruption before the restore', async () => {
    const view = render(<NewYearElfFireworks />);
    await flush();
    vi.spyOn(performance, 'now').mockReturnValue(5000);
    firstFrame();
    const { onStop } = vi.mocked(animateCelebrationSnapshots).mock.calls[0][2];

    act(() => onStop?.());

    expectReleased();
    expect(view.container.querySelector('[data-new-year-scene]')).toBeNull();
    view.unmount();
  });

  it('shows the still without loading the player under reduced motion', async () => {
    state.reduced = true;
    const view = render(<NewYearElfFireworks />);
    await flush();

    expect(loadLottiePlayer).not.toHaveBeenCalled();
    expect(animateCelebrationSnapshots).not.toHaveBeenCalled();
    const still = view.container.querySelector('[data-elf-fireworks-static]');
    expect(still).not.toBeNull();
    expect(still?.parentElement?.getAttribute('aria-hidden')).toBe('true');
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows the still when the composer leaves no room above it', async () => {
    buildComposer(60);
    const view = render(<NewYearElfFireworks />);
    await flush();

    expect(
      view.container.querySelector('[data-elf-fireworks-static]'),
    ).not.toBeNull();
    expect(player.loadAnimation).not.toHaveBeenCalled();
    view.unmount();
  });

  it('accumulates nothing over repeated activation and cancellation', async () => {
    for (let run = 0; run < 5; run++) {
      const view = render(<NewYearElfFireworks />);
      await flush();
      firstFrame();
      act(() => window.dispatchEvent(new Event('pointerdown')));
      view.unmount();
      expect(view.container.childElementCount).toBe(0);
    }

    expect(animateCelebrationSnapshots).toHaveBeenCalledTimes(5);
    expect(stopButton).toHaveBeenCalledTimes(5);
    expect(document.querySelector('[data-elf-button-layer]')).toBeNull();
    expect(document.querySelector('[data-new-year-scene]')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
