import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animateSkeletons } from '../halloween-skeleton-animation';
import {
  buildSkeletonPlan,
  SKELETON_ANIMATION_LIMIT,
  SKELETON_MS,
  type SkeletonPlan,
} from '../halloween-skeleton-plan';
const descriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'animate',
);
let fixture: HTMLElement,
  host: HTMLElement,
  draft: HTMLTextAreaElement,
  plan: SkeletonPlan,
  stop: (() => void) | undefined;
let onResize: ResizeObserverCallback;
const disconnect = vi.fn(),
  onStop = vi.fn();
const recorded: {
  element: Element;
  cancel: ReturnType<typeof vi.fn>;
  startTime?: number;
}[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  recorded.length = 0;
  fixture = document.createElement('div');
  fixture.innerHTML = '<textarea>Private draft</textarea>';
  document.body.append(fixture);
  draft = fixture.querySelector('textarea')!;
  draft.focus();
  draft.setSelectionRange(2, 7, 'backward');
  vi.runOnlyPendingTimers();
  const rect = new DOMRect(400, 600, 500, 100);
  vi.spyOn(fixture, 'getBoundingClientRect').mockReturnValue(rect);
  plan = buildSkeletonPlan(
    {
      width: 1280,
      height: 900,
      rtl: false,
      composer: { element: fixture, rect },
    },
    false,
  );
  const parts = (names: string[]) =>
    names.map((name) => `<i data-skeleton-part="${name}"></i>`).join('');
  const limbs = [
    'body',
    'skull',
    'arm-left',
    'arm-right',
    'leg-left',
    'leg-right',
  ];
  host = document.createElement('div');
  document.body.append(host);
  host.innerHTML =
    `<div data-skeleton-ledge></div>` +
    `<div data-skeleton-actor="showman"><div data-skeleton-facing>${parts([...limbs, 'face'])}</div></div>` +
    `<div data-skeleton-actor="partner"><div data-skeleton-facing>${parts(limbs)}</div></div>` +
    `<div data-skeleton-free-skull><div data-skeleton-turn>${parts(['face'])}</div></div>`;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        onResize = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value: vi.fn(function (this: Element) {
      const a = { element: this, cancel: vi.fn() };
      recorded.push(a);
      return a;
    }),
  });
});
afterEach(() => {
  stop?.();
  stop = undefined;
  host.remove();
  fixture.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  if (descriptor)
    Object.defineProperty(Element.prototype, 'animate', descriptor);
  else Reflect.deleteProperty(Element.prototype, 'animate');
});
const play = () => {
  stop = animateSkeletons(plan, host, onStop);
};
const stopped = () => {
  expect(onStop).toHaveBeenCalledOnce();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(recorded.every((a) => a.cancel.mock.calls.length === 1)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
};
describe('animateSkeletons', () => {
  it('keeps draft, selection, focus and DOM intact without measuring during playback', () => {
    const html = fixture.outerHTML;
    play();
    expect(recorded).toHaveLength(SKELETON_ANIMATION_LIMIT - 1);
    expect(recorded.every((a) => host.contains(a.element))).toBe(true);
    expect(fixture.outerHTML).toBe(html);
    expect(draft.value).toBe('Private draft');
    expect(document.activeElement).toBe(draft);
    expect([
      draft.selectionStart,
      draft.selectionEnd,
      draft.selectionDirection,
    ]).toEqual([2, 7, 'backward']);
    vi.advanceTimersByTime(SKELETON_MS);
    expect(fixture.getBoundingClientRect).not.toHaveBeenCalled();
    stopped();
  });
  it.each([
    'pointerdown',
    'keydown',
    'focusin',
    'beforeinput',
    'input',
    'compositionstart',
    'scroll',
    'visibilitychange',
    'resize',
  ])('releases all work once on %s', (name) => {
    play();
    if (name === 'visibilitychange')
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    (name === 'resize' ? window : document).dispatchEvent(new Event(name));
    stop?.();
    vi.advanceTimersByTime(SKELETON_MS);
    stopped();
  });
  it('does not interrupt a visible document on a visibility notification', () => {
    play();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onStop).not.toHaveBeenCalled();
  });
  it.each(['mutation', 'removal', 'ancestor'])(
    'stops for relevant %s',
    async (kind) => {
      play();
      if (kind === 'mutation') draft.setAttribute('style', 'height:40px');
      else if (kind === 'removal') fixture.remove();
      else document.body.setAttribute('dir', 'rtl');
      await Promise.resolve();
      stopped();
      document.body.removeAttribute('dir');
    },
  );
  it('revalidates an unrelated toast removal without cancelling or polling', async () => {
    const toast = document.createElement('aside');
    document.body.append(toast);
    play();
    toast.remove();
    await Promise.resolve();
    expect(onStop).not.toHaveBeenCalled();
    expect(fixture.getBoundingClientRect).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(20000);
    expect(fixture.getBoundingClientRect).toHaveBeenCalledOnce();
  });
  it('cancels resized geometry after the initial observer delivery', () => {
    play();
    onResize(
      [
        {
          target: fixture,
          borderBoxSize: [{ inlineSize: 500, blockSize: 100 }],
        },
      ] as unknown as ResizeObserverEntry[],
      {} as ResizeObserver,
    );
    expect(onStop).not.toHaveBeenCalled();
    onResize(
      [
        {
          target: fixture,
          borderBoxSize: [{ inlineSize: 510, blockSize: 100 }],
        },
      ] as unknown as ResizeObserverEntry[],
      {} as ResizeObserver,
    );
    stopped();
  });
  it('cleans up a partial setup failure and cannot retain orphan animations', () => {
    vi.mocked(Element.prototype.animate)
      .mockImplementationOnce(function (this: Element) {
        const a = { element: this, cancel: vi.fn() };
        recorded.push(a);
        return a as unknown as Animation;
      })
      .mockImplementationOnce(() => {
        throw Error('unsupported');
      });
    play();
    stopped();
  });
  it('enforces the keyframe limit before starting unbounded playback', () => {
    plan.skull.turn = Array.from({ length: 81 }, (_, i) => ({
      offset: i / 80,
    }));
    play();
    expect(recorded).toHaveLength(18);
    stopped();
  });

  it('refuses playback when the artwork is missing', () => {
    host.querySelector('[data-skeleton-free-skull]')!.remove();
    play();
    expect(recorded).toHaveLength(17);
    stopped();
  });

  describe('greeting word', () => {
    const highlights = new Map<string, unknown>();
    let heading: HTMLElement;
    beforeEach(() => {
      highlights.clear();
      vi.stubGlobal('CSS', { highlights });
      vi.stubGlobal(
        'Highlight',
        class {
          constructor(readonly range: Range) {}
        },
      );
      heading = document.createElement('h1');
      heading.textContent = 'Good evening, Valery';
      document.body.append(heading);
      const text = heading.firstChild!;
      const range = document.createRange();
      range.setStart(text, 14);
      range.setEnd(text, 20);
      vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(500, 480, 280, 44),
      );
      plan = buildSkeletonPlan(
        {
          width: 1280,
          height: 900,
          rtl: false,
          composer: {
            element: fixture,
            rect: new DOMRect(400, 600, 500, 100),
          },
          word: {
            heading,
            headingRect: new DOMRect(500, 480, 280, 44),
            range,
            rect: new DOMRect(700, 490, 90, 40),
            text: 'Valery',
            font: {
              fontFamily: 'Inter',
              fontSize: '32px',
              fontWeight: '600',
              fontStyle: 'normal',
              letterSpacing: 'normal',
              color: 'rgb(0, 0, 0)',
              textTransform: 'none',
            },
          },
        },
        false,
      );
      host.insertAdjacentHTML('beforeend', '<div data-skeleton-word></div>');
    });
    afterEach(() => heading.remove());

    it('hides only the word at the grab and restores it when the copy lands', () => {
      expect(plan.word).toBeDefined();
      const html = heading.outerHTML;
      play();
      expect(recorded).toHaveLength(SKELETON_ANIMATION_LIMIT);
      expect(highlights.size).toBe(0);
      vi.advanceTimersByTime(plan.word!.hideAt);
      expect(highlights.has('celebration-skeleton-word')).toBe(true);
      expect(heading.outerHTML).toBe(html);
      vi.advanceTimersByTime(plan.word!.restoreAt - plan.word!.hideAt);
      expect(highlights.size).toBe(0);
      vi.advanceTimersByTime(SKELETON_MS);
      stopped();
    });

    it.each(['keydown', 'heading change'])(
      'restores the word immediately on %s',
      async (kind) => {
        play();
        vi.advanceTimersByTime(plan.word!.hideAt + 100);
        expect(highlights.size).toBe(1);
        if (kind === 'keydown') document.dispatchEvent(new Event('keydown'));
        else {
          heading.textContent = 'Good evening';
          await Promise.resolve();
        }
        expect(highlights.size).toBe(0);
        stopped();
      },
    );
  });

  it('shares one start time across all tracks', () => {
    const timeline = Object.getOwnPropertyDescriptor(document, 'timeline');
    Object.defineProperty(document, 'timeline', {
      configurable: true,
      value: { currentTime: 1234 },
    });
    play();
    expect(recorded.map((a) => a.startTime)).toEqual(recorded.map(() => 1234));
    if (timeline) Object.defineProperty(document, 'timeline', timeline);
    else Reflect.deleteProperty(document, 'timeline');
  });
});
