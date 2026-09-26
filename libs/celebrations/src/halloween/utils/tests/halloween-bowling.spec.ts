import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CelebrationHistoryRow } from '../../../utils/celebration-history';
import {
  animateBowling,
  buildBowlingPlan,
  getBowlingContactRect,
  BOWLING_ANIMATION_MS,
  BOWLING_ROLL_START,
  BOWLING_ROLL_END,
} from '../halloween-bowling';

const rowsAt = (left: number): CelebrationHistoryRow[] =>
  Array.from({ length: 10 }, (_, index) => ({
    element: document.createElement('li'),
    rect: new DOMRect(left, 100 + index * 42, 280, 36),
  }));

describe('bowling contact geometry', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([360, 900, 1280, 1920])(
    'hits only nearby rows at their exact contact positions at width %s',
    (width) => {
      vi.spyOn(Math, 'random').mockReturnValue(0.55);
      for (const left of [10, width - 290]) {
        const rows = rowsAt(left);
        const plan = buildBowlingPlan(rows, width, 800);
        if (!plan) throw new Error('Expected a bowling plan');
        expect(plan.hits.map((hit) => hit.element)).toEqual([
          rows[5].element,
          rows[4].element,
          rows[6].element,
        ]);
        for (const hit of plan.hits) {
          const progress =
            (hit.contact - BOWLING_ROLL_START) /
            (BOWLING_ROLL_END - BOWLING_ROLL_START);
          const x = plan.startX + (plan.endX - plan.startX) * progress;
          const distance = (centerX: number) =>
            Math.hypot(
              Math.max(hit.rect.left - centerX, centerX - hit.rect.right, 0),
              Math.max(hit.rect.top - plan.y, plan.y - hit.rect.bottom, 0),
            );
          expect(distance(x)).toBeCloseTo(plan.radius, 6);
          expect(distance(x - plan.direction)).toBeGreaterThan(plan.radius);
          expect(hit.contact).toBeGreaterThan(BOWLING_ROLL_START);
          expect(hit.contact).toBeLessThan(BOWLING_ROLL_END);
        }
      }
    },
  );

  it('chooses the hit group from the path even with reordered or unevenly spaced rows', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const rows = rowsAt(10);
    const rearranged = [rows[5], rows[1], rows[9], rows[6], rows[0], rows[4]];
    const plan = buildBowlingPlan(rearranged, 1280, 800);
    expect(plan?.hits.map((hit) => hit.element)).toEqual([
      rows[5].element,
      rows[6].element,
      rows[4].element,
    ]);
  });

  it('leaves no hit rows when history is absent', () => {
    expect(buildBowlingPlan([], 1280, 800)).toBeNull();
  });

  it('hits the clipped visible title instead of the invisible trailing width of its row', () => {
    const row = rowsAt(10)[0];
    row.element.innerHTML =
      '<a href="/conversations/example"><span>Long conversation name</span></a>';
    const title = row.element.querySelector('span');
    if (!title) throw new Error('Missing title fixture');
    title.style.overflow = 'hidden';
    vi.spyOn(title, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(60, 108, 100, 20),
    );
    vi.spyOn(document, 'createRange').mockReturnValue({
      selectNodeContents: vi.fn(),
      getClientRects: () => [new DOMRect(60, 108, 220, 20)],
    } as unknown as Range);
    expect(getBowlingContactRect(row)).toEqual(new DOMRect(60, 108, 100, 20));
    const plan = buildBowlingPlan([row], 1280, 800);
    if (!plan) throw new Error('Expected a bowling plan');
    const progress =
      (plan.hits[0].contact - BOWLING_ROLL_START) /
      (BOWLING_ROLL_END - BOWLING_ROLL_START);
    const contactX = plan.startX + (plan.endX - plan.startX) * progress;
    expect(contactX - plan.radius).toBeCloseTo(160, 6);
    expect(contactX).toBeLessThan(row.rect.right);
  });
});

describe('bowling collision playback', () => {
  let host: HTMLElement;
  let actor: HTMLElement;
  let spin: SVGElement;
  let rows: CelebrationHistoryRow[];
  let stop: (() => void) | undefined;
  const animations: { cancel: ReturnType<typeof vi.fn>; startTime?: number }[] =
    [];
  const animateDescriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    'animate',
  );
  const timelineDescriptor = Object.getOwnPropertyDescriptor(
    document,
    'timeline',
  );
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.55);
    rows = rowsAt(10);
    rows.forEach(({ element }, index) => {
      element.textContent = `Chat ${index}`;
    });
    host = document.createElement('div');
    actor = document.createElement('div');
    spin = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    document.body.append(...rows.map((row) => row.element), host, actor);
    Object.defineProperty(document, 'timeline', {
      configurable: true,
      value: { currentTime: 1200 },
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
    animations.length = 0;
    host.remove();
    actor.remove();
    rows.forEach(({ element }) => element.remove());
    if (animateDescriptor)
      Object.defineProperty(Element.prototype, 'animate', animateDescriptor);
    else delete (Element.prototype as Partial<Element>).animate;
    if (timelineDescriptor)
      Object.defineProperty(document, 'timeline', timelineDescriptor);
    else Reflect.deleteProperty(document, 'timeline');
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('keeps rows stationary until contact and aligns travel, spin and row animations to one clock', () => {
    const plan = buildBowlingPlan(rows, 1280, 800);
    if (!plan) throw new Error('Expected a bowling plan');
    stop = animateBowling(plan, host, actor, spin);
    expect(host.children).toHaveLength(3);
    expect(Array.from(host.children, (copy) => copy.textContent)).toEqual([
      'Chat 5',
      'Chat 4',
      'Chat 6',
    ]);
    animations.forEach((animation) => expect(animation.startTime).toBe(1200));
    const calls = vi.mocked(actor.animate).mock.calls;
    plan.hits.forEach((hit, index) => {
      const frames = calls[2 + index * 2][0] as Keyframe[];
      frames
        .filter((frame) => (frame.offset ?? 0) <= hit.contact)
        .forEach((frame) => expect(frame.transform).toBe('none'));
      expect(frames.find((frame) => frame.offset === hit.contact)?.easing).toBe(
        'ease-out',
      );
      expect(
        frames.find((frame) => frame.offset === hit.contact + 0.13)?.transform,
      ).toContain('translate(-');
      expect(frames.find((frame) => frame.offset === 0.94)?.transform).toBe(
        'none',
      );
      const originalFrames = calls[3 + index * 2][0] as Keyframe[];
      expect(
        originalFrames.find((frame) => frame.offset === hit.contact)?.opacity,
      ).toBe(0);
    });
    const animatedElements = vi.mocked(actor.animate).mock.contexts;
    [0, 1, 2, 3, 7, 8, 9].forEach((index) =>
      expect(animatedElements).not.toContain(rows[index].element),
    );
    expect(
      (calls[1][0] as Keyframe[]).find(
        (frame) => frame.offset === BOWLING_ROLL_END,
      )?.transform,
    ).toBe(`rotate(${(plan.endX - plan.startX) / plan.radius}rad)`);
  });

  it.each(['pointerdown', 'scroll', 'resize', 'deadline'])(
    'restores rows and stops the ball on %s',
    (cause) => {
      const plan = buildBowlingPlan(rows, 1280, 800);
      if (!plan) throw new Error('Expected a bowling plan');
      stop = animateBowling(plan, host, actor, spin);
      if (cause === 'deadline') vi.advanceTimersByTime(BOWLING_ANIMATION_MS);
      else
        (cause === 'resize' ? window : document).dispatchEvent(
          new Event(cause),
        );
      expect(host.children).toHaveLength(0);
      stop();
      animations.forEach((animation) =>
        expect(animation.cancel).toHaveBeenCalledOnce(),
      );
    },
  );
});
