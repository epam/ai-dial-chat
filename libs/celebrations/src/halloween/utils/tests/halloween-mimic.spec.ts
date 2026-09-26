import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animateMimic, buildMimicPlan } from '../halloween-mimic';

describe('mimic tongue attachment', () => {
  const originalAnimate = Object.getOwnPropertyDescriptor(
    Element.prototype,
    'animate',
  );
  const originalTimeline = Object.getOwnPropertyDescriptor(
    document,
    'timeline',
  );
  let host: HTMLElement;
  let tongue: SVGElement;
  let loop: SVGElement;
  let backGrip: SVGElement;
  let elements: HTMLElement[];
  let stop: (() => void) | undefined;
  const animations: { cancel: ReturnType<typeof vi.fn>; startTime?: number }[] =
    [];
  beforeEach(() => {
    vi.useFakeTimers();
    host = document.createElement('div');
    tongue = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    loop = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    backGrip = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    for (const [grip, side] of [
      [loop, 'front'],
      [backGrip, 'back'],
    ] as const) {
      const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      wrap.dataset.mimicWrap = side;
      grip.appendChild(wrap);
    }
    elements = [document.createElement('li'), document.createElement('li')];
    document.body.append(...elements, host);
    Object.defineProperty(document, 'timeline', {
      configurable: true,
      value: { currentTime: 1500 },
    });
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value: vi.fn(() => {
        const animation = { cancel: vi.fn() };
        animations.push(animation);
        return animation;
      }),
    });
  });
  afterEach(() => {
    stop?.();
    stop = undefined;
    host.remove();
    elements.forEach((element) => element.remove());
    animations.length = 0;
    if (originalAnimate)
      Object.defineProperty(Element.prototype, 'animate', originalAnimate);
    else delete (Element.prototype as Partial<Element>).animate;
    if (originalTimeline)
      Object.defineProperty(document, 'timeline', originalTimeline);
    else Reflect.deleteProperty(document, 'timeline');
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  const play = () => {
    const targets = elements.map((element, index) => ({
      element,
      rect: new DOMRect(10, 250 + index * 40, 280, 36),
    }));
    const plan = buildMimicPlan(targets, new DOMRect(700, 200, 260, 260));
    if (!plan) throw new Error('Missing mimic fixture');
    stop = animateMimic(plan, host, tongue, loop, undefined, backGrip);
    return plan;
  };
  it('keeps both rows centered on the retracting tongue tip and inside its wrapping loop', () => {
    const plan = play();
    const calls = vi.mocked(host.animate).mock.calls;
    const frames = (element: Element): Keyframe[] =>
      calls[
        vi.mocked(host.animate).mock.contexts.indexOf(element)
      ][0] as Keyframe[];
    animations.forEach((animation) => expect(animation.startTime).toBe(1500));
    expect(host.children).toHaveLength(2);
    const parse = (frame: Keyframe) => {
      const match = String(frame.transform).match(
        /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/,
      );
      if (!match) throw new Error('Expected a captured-row transform');
      return {
        x: Number(match[1]),
        y: Number(match[2]),
        scale: Number(match[3]),
      };
    };
    for (const offset of [0.28, 0.33, 0.43, 0.57]) {
      const tongueFrame = frames(tongue).find(
        (frame) => frame.offset === offset,
      );
      const amount = Number(
        String(tongueFrame?.transform).match(/scale\((.+)\)/)?.[1],
      );
      const point = {
        x: plan.mouth.x + (plan.grab.x - plan.mouth.x) * amount,
        y: plan.mouth.y + (plan.grab.y - plan.mouth.y) * amount,
      };
      const rowCenters = plan.targets.map(({ rect }, index) => {
        const frame = frames(host.children[index]).find(
          (candidate) => candidate.offset === offset,
        );
        if (!frame) throw new Error('Missing pull frame');
        const move = parse(frame);
        expect(move.scale).toBe(amount);
        return {
          x: rect.left + rect.width / 2 + move.x,
          y: rect.top + rect.height / 2 + move.y,
        };
      });
      expect((rowCenters[0].x + rowCenters[1].x) / 2).toBeCloseTo(point.x);
      expect((rowCenters[0].y + rowCenters[1].y) / 2).toBeCloseTo(point.y);
      for (const grip of [loop, backGrip]) {
        const loopFrame = frames(grip).find((frame) => frame.offset === offset);
        if (!loopFrame) throw new Error('Missing grip frame');
        const move = parse(loopFrame);
        expect(plan.grab.x + move.x).toBeCloseTo(point.x);
        expect(plan.grab.y + move.y).toBeCloseTo(point.y);
      }
    }
    expect(
      frames(host.children[0]).find((frame) => frame.offset === 0.27)
        ?.transform,
    ).toBe('none');
  });
  it.each(['pointerdown', 'keydown', 'resize', 'deadline'])(
    'releases the capture on %s',
    (reason) => {
      play();
      if (reason === 'deadline') vi.advanceTimersByTime(8000);
      else
        (reason === 'resize' ? window : document).dispatchEvent(
          new Event(reason),
        );
      expect(host.children).toHaveLength(0);
      stop?.();
      animations.forEach((animation) =>
        expect(animation.cancel).toHaveBeenCalledOnce(),
      );
    },
  );
});
