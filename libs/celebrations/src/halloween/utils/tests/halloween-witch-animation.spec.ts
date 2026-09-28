import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animateWitches } from '../halloween-witch-animation';
import {
  buildWitchPlan,
  WITCH_ANIMATION_LIMIT,
  WITCH_RESTORE,
  WITCH_SCENE_MS,
  type WitchPlan,
} from '../halloween-witch-plan';

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
let plan: WitchPlan;
let actors: HTMLElement[];
let spells: HTMLElement[];
let frog: SVGSVGElement;
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
    '<div><textarea aria-label="Message">Unsent draft</textarea><button>Model</button><button>Attach</button></div>';
  document.body.appendChild(fixture);
  draft = fixture.querySelector('textarea')!;
  draft.focus();
  draft.setSelectionRange(2, 7, 'backward');
  vi.runOnlyPendingTimers();
  const composer = fixture.firstElementChild as HTMLElement;
  plan = buildWitchPlan(
    {
      width: 1280,
      height: 800,
      composer: rect(composer, 400, 300, 500, 150),
      buttons: Array.from(fixture.querySelectorAll('button')).map((button, i) =>
        rect(button, 440 + i * 110, 385, 80, 40),
      ),
    },
    false,
  );
  host = document.createElement('div');
  copies = document.createElement('div');
  host.appendChild(copies);
  document.body.appendChild(host);
  actors = plan.actors.map((actor) => {
    const element = document.createElement('div');
    Object.keys(actor.parts).forEach((part) => {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('data-witch-part', part);
      element.appendChild(group);
    });
    host.appendChild(element);
    return element;
  });
  spells = plan.spells.map(() => {
    const element = document.createElement('div');
    host.appendChild(element);
    return element;
  });
  frog = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const legs = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  legs.setAttribute('data-witch-frog-legs', '');
  frog.appendChild(legs);
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
  stop = animateWitches(plan, { host, copies, actors, spells, frog }, onStop);
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

describe('witch lesson playback ownership', () => {
  it('animates inert recognizable copies without changing the live draft, focus or layout', () => {
    const before = fixture.outerHTML;
    play();
    expect(copies.children).toHaveLength(2);
    for (const copy of Array.from(copies.children) as HTMLElement[]) {
      expect(copy.inert).toBe(true);
      expect(copy.getAttribute('aria-hidden')).toBe('true');
      expect(copy.style.pointerEvents).toBe('none');
      expect(copy.querySelector('button')?.textContent).toMatch(/Model|Attach/);
      expect(copy.querySelector('[data-witch-frog]')).not.toBeNull();
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
    expect(recorded.length).toBeLessThanOrEqual(WITCH_ANIMATION_LIMIT);
    const counts = plan.anchors.map(
      ({ element }) =>
        vi.mocked(element.getBoundingClientRect).mock.calls.length,
    );
    vi.advanceTimersByTime(15000);
    expect(
      plan.anchors.map(
        ({ element }) =>
          vi.mocked(element.getBoundingClientRect).mock.calls.length,
      ),
    ).toEqual(counts);
    expect(copies.children).toHaveLength(2);
    vi.advanceTimersByTime(WITCH_SCENE_MS - 15000);
    expectStopped();
  });
  it('keeps returned copies opaque until the snapshot helper restores their originals', () => {
    play();
    for (const [index, button] of plan.buttons.entries()) {
      const source = recorded.find(
        ({ element }) => element === button.target.element,
      )!;
      const copy = recorded.find(
        ({ element }) =>
          (element as HTMLElement).dataset.witchButton === String(index),
      )!;
      const sourceRestored = source.frames.find(
        (frame) => Number(frame.offset) > WITCH_RESTORE,
      )!;
      const copyRemoved = copy.frames.find(
        (frame) => Number(frame.offset) > WITCH_RESTORE && frame.opacity === 0,
      )!;
      expect(Number(copyRemoved.offset)).toBeGreaterThanOrEqual(
        Number(sourceRestored.offset),
      );
      const handoff = copy.frames.find(
        (frame) => frame.offset === WITCH_RESTORE,
      )!;
      expect(handoff.opacity).toBe(1);
      expect(handoff.easing).toBe('steps(1, end)');
    }
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
    vi.advanceTimersByTime(WITCH_SCENE_MS);
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
    plan.buttons[0].target.element.textContent = 'Changed';
    await Promise.resolve();
    expectStopped();
  });
  it('restores every resource when animation setup fails', () => {
    const animate = vi.mocked(Element.prototype.animate);
    const original = animate.getMockImplementation()!;
    animate.mockImplementation(function (this: Element, ...args) {
      if (recorded.length === 20) throw new Error('unsupported');
      return original.apply(this, args);
    });
    play();
    expectStopped();
  });
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
});
