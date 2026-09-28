import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animateCandy } from '../halloween-candy-animation';
import {
  buildCandyPlan,
  CANDY_MS,
  type CandyPlan,
} from '../halloween-candy-plan';
const descriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'animate',
);
let fixture: HTMLElement,
  host: HTMLElement,
  draft: HTMLTextAreaElement,
  plan: CandyPlan,
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
  const rect = new DOMRect(400, 300, 500, 100);
  vi.spyOn(fixture, 'getBoundingClientRect').mockReturnValue(rect);
  plan = buildCandyPlan(
    {
      width: 1280,
      height: 900,
      rtl: false,
      surfaces: [{ element: fixture, rect }],
    },
    false,
  );
  host = document.createElement('div');
  document.body.append(host);
  host.innerHTML =
    plan.sweets.map((_, i) => `<div data-candy-sweet="${i}"></div>`).join('') +
    plan.birds
      .map(
        (_, i) =>
          `<div data-candy-bird="${i}"><div data-candy-facing></div><div data-candy-head></div><div data-candy-wing></div></div>`,
      )
      .join('') +
    plan.janitors
      .map(
        (_, i) =>
          `<div data-candy-janitor="${i}"><div data-candy-facing></div><div data-candy-arms></div><div data-candy-leg="0"></div><div data-candy-leg="1"></div></div>`,
      )
      .join('');
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
  stop = animateCandy(plan, host, onStop);
};
const stopped = () => {
  expect(onStop).toHaveBeenCalledOnce();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(recorded.every((a) => a.cancel.mock.calls.length === 1)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
};
describe('Candy playback ownership', () => {
  it('keeps draft, selection, focus and DOM intact without measuring during playback', () => {
    const html = fixture.outerHTML;
    play();
    expect(recorded).toHaveLength(57);
    expect(recorded.every((a) => host.contains(a.element))).toBe(true);
    expect(fixture.outerHTML).toBe(html);
    expect(draft.value).toBe('Private draft');
    expect(document.activeElement).toBe(draft);
    expect([
      draft.selectionStart,
      draft.selectionEnd,
      draft.selectionDirection,
    ]).toEqual([2, 7, 'backward']);
    vi.advanceTimersByTime(CANDY_MS);
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
    vi.advanceTimersByTime(CANDY_MS);
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
  it('enforces track and keyframe limits before starting unbounded playback', () => {
    plan.animationLimit = 2;
    play();
    expect(recorded).toHaveLength(2);
    stopped();
  });
});
