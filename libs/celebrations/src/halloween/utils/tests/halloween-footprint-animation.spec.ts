import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animateFootprints } from '../halloween-footprint-animation';
import {
  buildFootprintPlan,
  FOOTPRINT_ANIMATION_LIMIT,
  FOOTPRINT_RESTORE,
  FOOTPRINT_MS,
  type FootprintPlan,
} from '../halloween-footprint-plan';

const originalAnimate = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'animate',
);
const recorded: {
  element: Element;
  frames: Keyframe[];
  animation: { cancel: ReturnType<typeof vi.fn>; startTime?: number };
}[] = [];
let fixture: HTMLElement;
let host: HTMLElement;
let copies: HTMLElement;
let draft: HTMLTextAreaElement;
let plan: FootprintPlan;
let prints: HTMLElement[];
let surface: HTMLElement;
let face: HTMLElement;
let stop: (() => void) | undefined;
let onResize: ResizeObserverCallback;
const disconnected = vi.fn();
const onStop = vi.fn();
const rect = (
  element: HTMLElement,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const bounds = new DOMRect(x, y, width, height);
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(bounds);
  return { element, rect: bounds };
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  recorded.length = 0;
  fixture = document.createElement('section');
  fixture.innerHTML =
    '<div><textarea aria-label="Message">Unsent draft</textarea><button>Model</button></div><button>Starter card</button>';
  document.body.appendChild(fixture);
  draft = fixture.querySelector('textarea')!;
  draft.focus();
  draft.setSelectionRange(2, 7, 'backward');
  vi.runOnlyPendingTimers();
  const composer = fixture.firstElementChild as HTMLElement;
  plan = buildFootprintPlan(
    {
      width: 1280,
      height: 800,
      composer: rect(composer, 400, 300, 500, 150),
      card: rect(fixture.lastElementChild as HTMLElement, 480, 230, 140, 44),
    },
    false,
  );
  host = document.createElement('div');
  copies = document.createElement('div');
  host.appendChild(copies);
  document.body.appendChild(host);
  prints = plan.prints.map(() => {
    const element = document.createElement('div');
    host.appendChild(element);
    return element;
  });
  surface = document.createElement('div');
  face = document.createElement('div');
  Object.keys(plan.faceParts).forEach((part) => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-footprint-part', part);
    face.appendChild(group);
  });
  host.append(surface, face);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        onResize = callback;
      }
      observe = vi.fn();
      disconnect = disconnected;
    },
  );
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value: vi.fn(function (this: Element, frames: Keyframe[]) {
      const animation = { cancel: vi.fn() };
      recorded.push({ element: this, frames, animation });
      return animation;
    }),
  });
});
afterEach(() => {
  stop?.();
  stop = undefined;
  host.remove();
  fixture.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  if (originalAnimate)
    Object.defineProperty(Element.prototype, 'animate', originalAnimate);
  else Reflect.deleteProperty(Element.prototype, 'animate');
});
const play = () => {
  stop = animateFootprints(
    plan,
    { host, copies, prints, surface, face },
    onStop,
  );
};
const expectStopped = () => {
  expect(copies.children).toHaveLength(0);
  expect(onStop).toHaveBeenCalledOnce();
  expect(disconnected).toHaveBeenCalledOnce();
  expect(
    recorded.every(({ animation }) => animation.cancel.mock.calls.length === 1),
  ).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
};

describe('invisible cat playback ownership', () => {
  it.each([true, false])(
    'animates only an input outline, preserving focused drafts, mobile=%s',
    (mobile) => {
      plan = buildFootprintPlan(
        { width: 1280, height: 800, composer: plan.anchors[0] },
        mobile,
      );
      const before = fixture.outerHTML;
      play();
      expect(copies.children).toHaveLength(0);
      expect(recorded).toHaveLength(mobile ? 13 : 17);
      expect(recorded.every(({ element }) => host.contains(element))).toBe(
        true,
      );
      expect(recorded.some(({ element }) => element === surface)).toBe(true);
      expect(fixture.outerHTML).toBe(before);
      expect(document.activeElement).toBe(draft);
      expect(draft.value).toBe('Unsent draft');
      expect([
        draft.selectionStart,
        draft.selectionEnd,
        draft.selectionDirection,
      ]).toEqual([2, 7, 'backward']);
      draft.dispatchEvent(new Event('beforeinput', { bubbles: true }));
      expectStopped();
    },
  );
  it('animates inert recognizable copies without changing the live draft, focus or layout', () => {
    const before = fixture.outerHTML;
    play();
    expect(copies.children).toHaveLength(1);
    for (const copy of Array.from(copies.children) as HTMLElement[]) {
      expect(copy.inert).toBe(true);
      expect(copy.getAttribute('aria-hidden')).toBe('true');
      expect(copy.style.pointerEvents).toBe('none');
      expect(copy.querySelector('button')?.textContent).toBe('Starter card');
    }
    expect(fixture.outerHTML).toBe(before);
    expect(document.activeElement).toBe(draft);
    expect(draft.value).toBe('Unsent draft');
    expect([
      draft.selectionStart,
      draft.selectionEnd,
      draft.selectionDirection,
    ]).toEqual([2, 7, 'backward']);
    expect(
      recorded.some(
        ({ element }) =>
          element === draft || element === plan.anchors[0].element,
      ),
    ).toBe(false);
    stop?.();
    expectStopped();
  });
  it('stays within the animation budget and does no layout polling during playback', () => {
    play();
    expect(recorded.length).toBeLessThanOrEqual(FOOTPRINT_ANIMATION_LIMIT);
    const counts = plan.anchors.map(
      ({ element }) =>
        vi.mocked(element.getBoundingClientRect).mock.calls.length,
    );
    vi.advanceTimersByTime(11000);
    expect(
      plan.anchors.map(
        ({ element }) =>
          vi.mocked(element.getBoundingClientRect).mock.calls.length,
      ),
    ).toEqual(counts);
    expect(copies.children).toHaveLength(1);
    vi.advanceTimersByTime(FOOTPRINT_MS - 11000);
    expectStopped();
  });
  it('keeps returned copies opaque until the snapshot helper restores their originals', () => {
    play();
    const source = recorded.find(
      ({ element }) => element === plan.card!.element,
    )!;
    const copy = recorded.find(
      ({ element }) => (element as HTMLElement).dataset.footprintCard,
    )!;
    const surfaceTrack = recorded.find(({ element }) => element === surface)!;
    expect(surfaceTrack.frames).toEqual(copy.frames);
    const sourceRestored = source.frames.find(
      (frame) => Number(frame.offset) > FOOTPRINT_RESTORE,
    )!;
    const copyRemoved = copy.frames.find(
      (frame) =>
        Number(frame.offset) > FOOTPRINT_RESTORE && frame.opacity === 0,
    )!;
    expect(Number(copyRemoved.offset)).toBeGreaterThanOrEqual(
      Number(sourceRestored.offset),
    );
    expect(
      copy.frames.find((frame) => frame.offset === FOOTPRINT_RESTORE),
    ).toMatchObject({ opacity: 1, easing: 'steps(1, end)' });
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
  ])('restores originals on %s and cannot resume', (event) => {
    play();
    if (event === 'visibilitychange')
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event(event));
    expectStopped();
    stop?.();
    vi.advanceTimersByTime(FOOTPRINT_MS);
    expect(onStop).toHaveBeenCalledOnce();
  });
  it('cancels on viewport or observed anchor resize', () => {
    play();
    window.dispatchEvent(new Event('resize'));
    expectStopped();
  });
  it('cancels when a measured anchor changes size without a window resize', () => {
    play();
    onResize(
      [
        {
          target: plan.anchors[0].element,
          borderBoxSize: [{ inlineSize: 700, blockSize: 150 }],
        } as unknown as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    );
    expectStopped();
  });
  it('cancels on source changes but ignores unrelated toast removal and decorative mutations', async () => {
    const toast = document.createElement('div');
    document.body.appendChild(toast);
    play();
    toast.remove();
    await Promise.resolve();
    expect(onStop).not.toHaveBeenCalled();
    plan.card!.element.textContent = 'Changed';
    await Promise.resolve();
    expectStopped();
  });
  it.each([5, 17, 18])(
    'restores every resource when setup fails at animation %s',
    (failure) => {
      const animate = vi.mocked(Element.prototype.animate);
      const original = animate.getMockImplementation()!;
      animate.mockImplementation(function (this: Element, ...args) {
        if (recorded.length === failure) throw new Error('unsupported');
        return original.apply(this, args);
      });
      play();
      expectStopped();
    },
  );
  it('repeated activation cannot accumulate snapshots, animations or deadlines', () => {
    for (let i = 0; i < 3; i++) {
      onStop.mockClear();
      disconnected.mockClear();
      recorded.length = 0;
      play();
      stop?.();
      expectStopped();
    }
  });
  it.each(['remove', 'disabled', 'ancestor', 'composer'])(
    'restores on %s mutations',
    async (change) => {
      play();
      if (change === 'remove') plan.card!.element.remove();
      if (change === 'disabled')
        plan.card!.element.setAttribute('disabled', '');
      if (change === 'ancestor') fixture.setAttribute('aria-hidden', 'true');
      if (change === 'composer') plan.anchors[0].element.className = 'moved';
      await Promise.resolve();
      expectStopped();
    },
  );
  it('plays a bounded decorative route when no card is available', () => {
    plan = buildFootprintPlan({ width: 1280, height: 800 }, false);
    play();
    expect(copies.children).toHaveLength(0);
    expect(recorded).toHaveLength(16);
    vi.advanceTimersByTime(FOOTPRINT_MS);
    expectStopped();
  });
});
