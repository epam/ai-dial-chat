/* Inert scene artwork has no accessible controls; inspect its player boundary. */
/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import { act, render, screen } from '@testing-library/react';
import type { AnimationConfigWithData, AnimationItem } from 'lottie-web';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animateCelebrationSnapshots } from '../../../../utils/celebration-snapshots';
import { loadLottiePlayer } from '../../../../utils/lottie-player';
import { SnowmanStage } from '../../../types/new-year';
import { SNOWMAN_DELIVERY_MS } from '../../../utils/snowman-delivery-composition';
import {
  getSnowmanDeliveryTargets,
  type SnowmanDeliveryTargets,
} from '../../../utils/snowman-delivery-targets';
import NewYearSnowmanDelivery from '../NewYearSnowmanDelivery';

const state = vi.hoisted(() => ({ mobile: false, reduced: false }));
vi.mock('../../../../context/CelebrationEnvironmentContext', async () => {
  const { testEnvironment } =
    await import('../../../../test-utils/environment');
  const anchors = { composer: 'snow-composer', starterList: 'snow-starters' };
  return {
    useCelebrationEnvironment: () =>
      testEnvironment({ anchors, isMobile: state.mobile }),
  };
});
vi.mock('../../../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => state.reduced,
}));
vi.mock('../../../utils/snowman-delivery-targets', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../../utils/snowman-delivery-targets')
  >()),
  getSnowmanDeliveryTargets: vi.fn(),
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
const stopCard = vi.fn();
const disconnect = vi.fn();
let card: HTMLButtonElement;
let draft: HTMLTextAreaElement;

const targets = (mode = SnowmanStage.Ledge): SnowmanDeliveryTargets => {
  const s = 0.9;
  const stanceX = 400 - 14 * s;
  const startX = stanceX + 36 * s + 70;
  return {
    width: 1280,
    height: 900,
    rtl: false,
    mode,
    scale: s,
    dir: 1,
    floor: 560 + 40 + 130 * s,
    startEdge: 240,
    stanceX,
    sled: { width: 140, height: 40, startX },
    seatFromFront: 35,
    slideLength: 240,
    headFlight: { distance: 83, seconds: 0.5 },
    snowbankX: startX + 70 + 240 + 8,
    branchX: startX + 35 + 240 + 83,
    treeX: startX + 35 + 240 + 83 + 26 * s,
    card: { element: card, rect: new DOMRect(400, 520, 140, 40) },
    bounds: { left: 240, right: 1280 },
    watched: [card],
  };
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
  expect(document.querySelector('[data-snowman-card-layer]')).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
};

describe('NewYearSnowmanDelivery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    state.mobile = false;
    state.reduced = false;
    animations.length = 0;
    document.body.innerHTML =
      '<textarea aria-label="Draft">Private draft</textarea><button>Tell me a riddle</button>';
    draft = screen.getByRole('textbox', {
      name: 'Draft',
    }) as HTMLTextAreaElement;
    card = screen.getByRole('button', {
      name: 'Tell me a riddle',
    }) as HTMLButtonElement;
    vi.mocked(getSnowmanDeliveryTargets).mockImplementation(() => targets());
    vi.mocked(animateCelebrationSnapshots).mockReturnValue(stopCard);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = disconnect;
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
    'plays one composition and starts the card copy on its first frame, mobile=%s',
    async (mobile) => {
      state.mobile = mobile;
      draft.focus();
      draft.setSelectionRange(2, 7, 'backward');
      const before = card.outerHTML;
      const view = render(
        <StrictMode>
          <NewYearSnowmanDelivery />
        </StrictMode>,
      );
      await flush();

      expect(loadLottiePlayer).toHaveBeenCalledOnce();
      expect(player.loadAnimation).toHaveBeenCalledOnce();
      expect(animations[0].play).toHaveBeenCalledOnce();
      const host = view.container.querySelector('[data-new-year-scene]');
      expect(host?.getAttribute('data-snowman-mode')).toBe(SnowmanStage.Ledge);
      expect(host?.getAttribute('aria-hidden')).toBe('true');
      /* The card layer sits beneath the renderer's SVG. */
      expect(
        host?.firstElementChild?.hasAttribute('data-snowman-card-layer'),
      ).toBe(true);
      expect(animateCelebrationSnapshots).not.toHaveBeenCalled();

      vi.spyOn(performance, 'now').mockReturnValue(1000);
      firstFrame(3);

      expect(animateCelebrationSnapshots).toHaveBeenCalledOnce();
      const [borrowed, layer, options] = vi.mocked(animateCelebrationSnapshots)
        .mock.calls[0];
      expect(borrowed).toEqual([expect.objectContaining({ element: card })]);
      expect(
        (layer as HTMLElement).hasAttribute('data-snowman-card-layer'),
      ).toBe(true);
      expect(options).toMatchObject({
        durationMs: SNOWMAN_DELIVERY_MS,
        startTime: 950,
      });
      expect(document.activeElement).toBe(draft);
      expect([draft.value, draft.selectionStart, draft.selectionEnd]).toEqual([
        'Private draft',
        2,
        7,
      ]);
      expect(card.outerHTML).toBe(before);

      act(() => vi.advanceTimersByTime(SNOWMAN_DELIVERY_MS));
      expectReleased();
      expect(stopCard).toHaveBeenCalledOnce();
      expect(view.container.querySelector('[data-new-year-scene]')).toBeNull();
      view.unmount();
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
  ])('ends at once and releases the card copy on %s', async (name) => {
    const view = render(<NewYearSnowmanDelivery />);
    await flush();
    firstFrame();
    if (name === 'visibilitychange')
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);

    act(() => window.dispatchEvent(new Event(name)));

    expectReleased();
    expect(stopCard).toHaveBeenCalledOnce();
    expect(view.container.querySelector('[data-new-year-scene]')).toBeNull();
    expect(view.container.querySelector('[data-snowman-static]')).toBeNull();
    view.unmount();
  });

  it('cancels when the snapshot helper reports an interruption before the restore', async () => {
    const view = render(<NewYearSnowmanDelivery />);
    await flush();
    vi.spyOn(performance, 'now').mockReturnValue(5000);
    firstFrame();
    const { onStop } = vi.mocked(animateCelebrationSnapshots).mock.calls[0][2];

    act(() => onStop?.());

    expectReleased();
    expect(view.container.querySelector('[data-new-year-scene]')).toBeNull();
    view.unmount();
  });

  it.each(['reduced', 'noResizeObserver', 'noMutationObserver'])(
    'shows the still without loading the player or measuring the host for %s',
    async (mode) => {
      state.reduced = mode === 'reduced';
      if (mode === 'noResizeObserver')
        vi.stubGlobal('ResizeObserver', undefined);
      if (mode === 'noMutationObserver')
        vi.stubGlobal('MutationObserver', undefined);
      const view = render(<NewYearSnowmanDelivery />);
      await flush();

      expect(loadLottiePlayer).not.toHaveBeenCalled();
      expect(getSnowmanDeliveryTargets).not.toHaveBeenCalled();
      expect(animateCelebrationSnapshots).not.toHaveBeenCalled();
      const still = view.container.querySelector('[data-snowman-static]');
      expect(still).not.toBeNull();
      expect(still?.parentElement?.getAttribute('aria-hidden')).toBe('true');
      view.unmount();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('shows the still when the player import fails', async () => {
    vi.mocked(loadLottiePlayer).mockRejectedValue(new Error('Load failed'));
    const view = render(<NewYearSnowmanDelivery />);
    await flush();

    expect(
      view.container.querySelector('[data-snowman-static]'),
    ).not.toBeNull();
    expect(player.loadAnimation).not.toHaveBeenCalled();
    view.unmount();
  });

  it('shows the still when no stage fits the story', async () => {
    vi.mocked(getSnowmanDeliveryTargets).mockImplementation(() =>
      targets(SnowmanStage.Static),
    );
    const view = render(<NewYearSnowmanDelivery />);
    await flush();

    expect(
      view.container.querySelector('[data-snowman-static]'),
    ).not.toBeNull();
    expect(player.loadAnimation).not.toHaveBeenCalled();
    expect(animateCelebrationSnapshots).not.toHaveBeenCalled();
    view.unmount();
  });

  it('accumulates nothing over repeated activation and cancellation', async () => {
    for (let run = 0; run < 5; run++) {
      const view = render(<NewYearSnowmanDelivery />);
      await flush();
      firstFrame();
      act(() => window.dispatchEvent(new Event('pointerdown')));
      view.unmount();
      expect(view.container.childElementCount).toBe(0);
    }

    expect(animateCelebrationSnapshots).toHaveBeenCalledTimes(5);
    expect(stopCard).toHaveBeenCalledTimes(5);
    expect(animations.every((a) => a.destroy.mock.calls.length === 1)).toBe(
      true,
    );
    expect(document.querySelector('[data-snowman-card-layer]')).toBeNull();
    expect(document.querySelector('[data-new-year-scene]')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
