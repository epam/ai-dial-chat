import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildGiftWrappingPlan } from '../gift-wrapping-plan';
import {
  getGiftWrappingTarget,
  type GiftWrappingTarget,
} from '../gift-wrapping-targets';

const target = (width: number, rtl = false): GiftWrappingTarget => ({
  width,
  height: 900,
  rtl,
  box: {
    left: width > 900 ? 400 : 16,
    top: 350,
    width: width > 900 ? 560 : Math.min(560, width - 32),
    height: 100,
  },
  source: null,
});

describe('Gift wrapping choreography', () => {
  it.each([360, 900, 1280, 1920])(
    'preserves hat and hand contact within budget at %ipx in both directions',
    (width) => {
      for (const rtl of [false, true]) {
        const plan = buildGiftWrappingPlan(target(width, rtl), width < 1280);
        expect(plan.tracks.length).toBeLessThanOrEqual(plan.animationLimit);
        expect(
          plan.tracks.reduce((sum, track) => sum + track.frames.length, 0),
        ).toBeLessThanOrEqual(plan.frameLimit);
        expect(plan.contacts.length).toBeGreaterThan(3);
        for (const contact of plan.contacts) {
          expect(
            Math.hypot(
              contact.hat.x - contact.knot.x,
              contact.hat.y - contact.knot.y,
            ),
          ).toBeLessThan(0.01);
          expect(
            Math.hypot(
              contact.hand.x - contact.knot.x,
              contact.hand.y - contact.knot.y,
            ),
          ).toBeLessThan(0.01);
        }
        for (const { frames } of plan.tracks) {
          expect(frames[0].offset).toBe(0);
          expect(frames.at(-1)?.offset).toBe(1);
          expect(frames.map((f) => f.offset)).toEqual(
            frames.map((f) => f.offset).sort((a, b) => (a ?? 0) - (b ?? 0)),
          );
          expect(JSON.stringify(frames)).not.toMatch(/NaN|Infinity/);
        }
      }
    },
  );

  it('keeps the hat bow attached to the helper when the stationary knot disappears', () => {
    const { tracks } = buildGiftWrappingPlan(target(1280), false);
    const finalBow = tracks.find((t) => t.selector.includes('data-elf-bow'));
    const knot = tracks.find((t) => t.selector === '[data-gift-knot]');
    if (!finalBow || !knot) throw new Error('Missing bow choreography');
    expect(finalBow.frames.find((f) => f.opacity === 1)?.offset).toBe(
      knot.frames.find((f) => (f.offset ?? 0) > 0.6 && f.opacity === 0)?.offset,
    );
    expect(
      tracks
        .filter((t) => t.selector.startsWith('[data-gift-ribbon'))
        .every((t) => t.frames.at(-1)?.opacity === 0),
    ).toBe(true);
    for (const actor of [0, 1])
      expect(
        tracks
          .find((t) => t.selector === `[data-gift-elf="${actor}"]`)
          ?.frames.at(-1)?.opacity,
      ).toBe(0);
  });
});

describe('Gift wrapping target eligibility', () => {
  let fixture: HTMLDivElement;
  beforeEach(() => {
    fixture = document.createElement('div');
    fixture.className = 'gift-composer';
    fixture.innerHTML = '<textarea aria-label="Message">Draft</textarea>';
    document.body.append(fixture);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      1280,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      900,
    );
    vi.spyOn(fixture, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(400, 350, 560, 100),
    );
    const original = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const style = original(element);
      return {
        ...style,
        display: style.display,
        visibility: style.visibility || 'visible',
        opacity: style.opacity,
        contentVisibility: style.contentVisibility,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        direction: style.direction || 'ltr',
      } as CSSStyleDeclaration;
    });
  });
  afterEach(() => {
    fixture.remove();
    vi.restoreAllMocks();
  });

  it('measures an already-focused composer without touching its draft or selection', () => {
    const input = fixture.querySelector('textarea');
    if (!input) throw new Error('Missing draft fixture');
    input.focus();
    input.setSelectionRange(1, 3, 'backward');
    const before = fixture.outerHTML;
    const selected = getGiftWrappingTarget(
      { composer: 'gift-composer' },
      false,
    );
    expect(selected.source?.element).toBe(fixture);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('Draft');
    expect([
      input.selectionStart,
      input.selectionEnd,
      input.selectionDirection,
    ]).toEqual([1, 3, 'backward']);
    expect(fixture.outerHTML).toBe(before);
  });

  it.each([
    'missing',
    'hidden',
    'offscreen',
    'tooHigh',
    'tooNarrow',
    'clipped',
    'deep',
  ])('uses its own parcel for a %s composer', (mode) => {
    if (mode === 'missing') fixture.className = '';
    if (mode === 'hidden') fixture.hidden = true;
    if (mode === 'offscreen')
      vi.mocked(fixture.getBoundingClientRect).mockReturnValue(
        new DOMRect(-10, 350, 560, 100),
      );
    if (mode === 'tooHigh')
      vi.mocked(fixture.getBoundingClientRect).mockReturnValue(
        new DOMRect(400, 30, 560, 100),
      );
    if (mode === 'tooNarrow')
      vi.mocked(fixture.getBoundingClientRect).mockReturnValue(
        new DOMRect(400, 350, 120, 100),
      );
    const parent = document.createElement('div');
    if (mode === 'clipped' || mode === 'deep') {
      document.body.append(parent);
      if (mode === 'clipped') {
        parent.style.overflowX = 'hidden';
        vi.spyOn(parent, 'getBoundingClientRect').mockReturnValue(
          new DOMRect(400, 350, 100, 100),
        );
        parent.append(fixture);
      } else {
        let last = parent;
        for (let i = 0; i < 25; i++) {
          const next = document.createElement('div');
          last.append(next);
          last = next;
        }
        last.append(fixture);
      }
    }
    expect(
      getGiftWrappingTarget({ composer: 'gift-composer' }, false).source,
    ).toBeNull();
    parent.remove();
  });

  it('inherits RTL from the composer rather than application locale', () => {
    fixture.style.direction = 'rtl';
    expect(getGiftWrappingTarget({ composer: 'gift-composer' }, true).rtl).toBe(
      true,
    );
  });
});
