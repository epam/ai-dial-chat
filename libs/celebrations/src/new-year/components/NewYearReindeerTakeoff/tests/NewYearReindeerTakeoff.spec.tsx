/* Decorative artwork has no accessible controls; inspect the player boundary. */
/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import { act, render, screen } from '@testing-library/react';
import type { AnimationConfigWithData, AnimationItem } from 'lottie-web';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadLottiePlayer } from '../../../../utils/lottie-player';
import {
  getReindeerTargets,
  type ReindeerTargets,
} from '../../../utils/reindeer-targets';
import { animateReindeerText } from '../../../utils/reindeer-text';
import NewYearReindeerTakeoff from '../NewYearReindeerTakeoff';

const state = vi.hoisted(() => ({ isMobile: false, isReduced: false }));
vi.mock('../../../../context/CelebrationEnvironmentContext', async () => {
  const { testEnvironment } =
    await import('../../../../test-utils/environment');
  const anchors = { composer: 'composer' };
  return {
    useCelebrationEnvironment: () =>
      testEnvironment({ anchors, isMobile: state.isMobile }),
  };
});
vi.mock('../../../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => state.isReduced,
}));
vi.mock('../../../utils/reindeer-targets', () => ({
  getReindeerTargets: vi.fn(),
}));
vi.mock('../../../../utils/lottie-player', async (original) => ({
  ...(await original<typeof import('../../../../utils/lottie-player')>()),
  loadLottiePlayer: vi.fn(),
}));
vi.mock('../../../utils/reindeer-text', () => ({
  animateReindeerText: vi.fn(),
}));

const player = {
  loadAnimation:
    vi.fn<(config: AnimationConfigWithData<'svg'>) => AnimationItem>(),
};
const stopCopy = vi.fn();
const destroy = vi.fn();
let callbacks: Map<string, () => void>;
let button: HTMLButtonElement;
let draft: HTMLTextAreaElement;
const targets = (): ReindeerTargets => ({
  width: 1280,
  height: 900,
  dir: 1,
  scale: 0.85,
  origin: [640, 700],
  catchPoint: [600, 610],
  bounds: { left: 0, right: 1280 },
  rim: { left: 360, right: 920 },
  composer: { element: button, rect: new DOMRect(360, 700, 560, 100) },
  word: {
    element: draft,
    rect: new DOMRect(578, 568, 44, 20),
    text: 'My',
    style: {},
    background: 'rgb(255, 255, 255)',
  },
  watched: [button],
  isStatic: false,
});
const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
};
const startCopy = () => act(() => callbacks.get('enterFrame')?.());

describe('NewYearReindeerTakeoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    state.isMobile = false;
    state.isReduced = false;
    document.body.innerHTML =
      '<textarea aria-label="Draft">My private draft</textarea><button>Attach</button>';
    button = screen.getByRole('button', {
      name: 'Attach',
    }) as HTMLButtonElement;
    draft = screen.getByRole('textbox', {
      name: 'Draft',
    }) as HTMLTextAreaElement;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value: vi.fn(() => ({ cancel: vi.fn(), startTime: 0 })),
    });
    vi.mocked(getReindeerTargets).mockImplementation(targets);
    vi.mocked(animateReindeerText).mockReturnValue(stopCopy);
    player.loadAnimation.mockImplementation(({ container }) => {
      callbacks = new Map();
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      container.append(svg);
      destroy.mockImplementation(() => svg.remove());
      queueMicrotask(() => callbacks.get('DOMLoaded')?.());
      return {
        isLoaded: true,
        frameRate: 60,
        currentFrame: 0,
        setSubframe: vi.fn(),
        play: vi.fn(),
        destroy,
        addEventListener: (name: string, cb: () => void) =>
          callbacks.set(name, cb),
        removeEventListener: (name: string) => callbacks.delete(name),
      } as unknown as AnimationItem;
    });
    vi.mocked(loadLottiePlayer).mockResolvedValue(player);
  });
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.each([false, true])(
    'plays one bounded composition and preserves draft/focus, mobile=%s',
    async (isMobile) => {
      state.isMobile = isMobile;
      draft.focus();
      draft.setSelectionRange(2, 5);
      const before = button.outerHTML;
      const view = render(
        <StrictMode>
          <NewYearReindeerTakeoff />
        </StrictMode>,
      );
      await flush();
      expect(player.loadAnimation).toHaveBeenCalledOnce();
      expect(animateReindeerText).not.toHaveBeenCalled();
      startCopy();
      expect(animateReindeerText).toHaveBeenCalledOnce();
      expect(vi.mocked(animateReindeerText).mock.calls[0][3]).toBe(23000);
      expect(vi.mocked(animateReindeerText).mock.calls[0][4]).toEqual(
        expect.any(Number),
      );
      expect(document.activeElement).toBe(draft);
      expect(draft.value).toBe('My private draft');
      expect([draft.selectionStart, draft.selectionEnd]).toEqual([2, 5]);
      expect(button.outerHTML).toBe(before);
      act(() => vi.advanceTimersByTime(23000));
      expect(destroy).toHaveBeenCalledOnce();
      expect(stopCopy).toHaveBeenCalledOnce();
      expect(callbacks.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
      expect(view.container.querySelector('[data-new-year-scene]')).toBeNull();
      view.unmount();
      expect(destroy).toHaveBeenCalledOnce();
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
  ])('releases the borrowed word immediately on %s', async (name) => {
    const view = render(<NewYearReindeerTakeoff />);
    await flush();
    startCopy();
    if (name === 'visibilitychange')
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => window.dispatchEvent(new Event(name)));
    expect(destroy).toHaveBeenCalledOnce();
    expect(stopCopy).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    expect(callbacks.size).toBe(0);
    expect(view.container.querySelector('[data-new-year-scene]')).toBeNull();
  });
  it('shows the static resolution without loading or measuring for reduced motion', async () => {
    state.isReduced = true;
    const view = render(<NewYearReindeerTakeoff />);
    await flush();
    expect(
      view.container.querySelector('[data-reindeer-static]'),
    ).not.toBeNull();
    expect(loadLottiePlayer).not.toHaveBeenCalled();
    expect(getReindeerTargets).not.toHaveBeenCalled();
    expect(animateReindeerText).not.toHaveBeenCalled();
  });
  it('shows the static resolution after failed loading', async () => {
    vi.mocked(loadLottiePlayer).mockRejectedValue(new Error('Unavailable'));
    const view = render(<NewYearReindeerTakeoff />);
    await flush();
    expect(
      view.container.querySelector('[data-reindeer-static]'),
    ).not.toBeNull();
    expect(getReindeerTargets).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('uses the static resolution on a crowded page without borrowing', async () => {
    vi.mocked(getReindeerTargets).mockReturnValue({
      ...targets(),
      isStatic: true,
    });
    const view = render(<NewYearReindeerTakeoff />);
    await flush();
    expect(
      view.container.querySelector('[data-reindeer-static]'),
    ).not.toBeNull();
    expect(animateReindeerText).not.toHaveBeenCalled();
  });
  it('ends on target mutation and destroys the player once', async () => {
    render(<NewYearReindeerTakeoff />);
    await flush();
    startCopy();
    await act(async () => {
      button.textContent = 'Changed attachment';
      await Promise.resolve();
    });
    expect(destroy).toHaveBeenCalledOnce();
    expect(stopCopy).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('ends on direction changes even when the host supplies no anchors', async () => {
    vi.mocked(getReindeerTargets).mockReturnValue({
      ...targets(),
      word: null,
      watched: [],
    });
    render(<NewYearReindeerTakeoff />);
    await flush();
    await act(async () => {
      document.documentElement.dir = 'rtl';
      await Promise.resolve();
    });
    expect(destroy).toHaveBeenCalledOnce();
    expect(animateReindeerText).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    document.documentElement.removeAttribute('dir');
  });
});
