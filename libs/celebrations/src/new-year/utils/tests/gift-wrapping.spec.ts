import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import elves from '../../assets/gift-wrapping-elves.json';
import { NEW_YEAR_SCENE_DURATIONS } from '../../constants/new-year';
import { NewYearScene } from '../../types/new-year';
import { GIFT_WRAPPING_TIMINGS } from '../gift-wrapping-animation';
import {
  buildGiftWrappingComposition,
  GIFT_WRAPPING_MS,
} from '../gift-wrapping-composition';
import { ELF_RIG } from '../gift-wrapping-rig';
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

type NativeLayer = ReturnType<
  typeof buildGiftWrappingComposition
>['animationData']['layers'][number];
type NativeShape = NativeLayer['shapes'][number];
type NativeTransform = NativeLayer['ks'];
interface NativePath {
  v: number[][];
  i: number[][];
  o: number[][];
}
interface NumericKeyframe {
  t: number;
  s: number[];
  h?: number;
  e?: number[];
  o?: { x: number; y: number };
  i?: { x: number; y: number };
}
interface PathKeyframe extends Omit<NumericKeyframe, 's' | 'e'> {
  s: NativePath[];
  e?: NativePath[];
}

/* Evaluate native player properties independently of the composition builder so
   contact assertions include the emitted easing, scale and rotation tracks. */
const numericAt = (
  property: NativeTransform['p'],
  seconds: number,
): number[] => {
  if (!property.a)
    return Array.isArray(property.k) ? property.k : [property.k as number];
  const keys = property.k as NumericKeyframe[];
  const frame = seconds * 60;
  const index = keys.findIndex((key) => key.t > frame);
  if (index < 0) return keys[keys.length - 1].s;
  if (index === 0) return keys[0].s;
  const from = keys[index - 1];
  const to = keys[index];
  if (from.h) return from.s;
  const progress = (frame - from.t) / (to.t - from.t);
  const out = from.o ?? { x: 0, y: 0 };
  const incoming = from.i ?? { x: 1, y: 1 };
  const cubic = (t: number, a: number, b: number) =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let amount = progress;
  for (let step = 0; step < 12; step++) {
    const slope =
      3 * (1 - amount) ** 2 * out.x +
      6 * (1 - amount) * amount * (incoming.x - out.x) +
      3 * amount ** 2 * (1 - incoming.x);
    if (Math.abs(slope) < 1e-8) break;
    amount = Math.max(
      0,
      Math.min(
        1,
        amount - (cubic(amount, out.x, incoming.x) - progress) / slope,
      ),
    );
  }
  const eased = cubic(amount, out.y, incoming.y);
  return from.s.map((value, axis) => value + (to.s[axis] - value) * eased);
};

const transformPoint = (
  point: number[],
  transform: NativeTransform,
  seconds: number,
): number[] => {
  const anchor = numericAt(transform.a, seconds);
  const position = numericAt(transform.p, seconds);
  const scale = numericAt(transform.s, seconds);
  const angle = (numericAt(transform.r, seconds)[0] * Math.PI) / 180;
  const x = ((point[0] - anchor[0]) * scale[0]) / 100;
  const y = ((point[1] - anchor[1]) * scale[1]) / 100;
  return [
    position[0] + x * Math.cos(angle) - y * Math.sin(angle),
    position[1] + x * Math.sin(angle) + y * Math.cos(angle),
  ];
};

const pathOf = (group: NativeShape): NativePath =>
  (group.it?.find((shape) => shape.ty === 'sh')?.ks as { k: NativePath }).k;

const shapeTransforms = (
  group: NativeShape,
  name: string,
): NativeTransform[] | undefined => {
  const own = group.it?.find((shape) => shape.ty === 'tr') as
    (NativeShape & NativeTransform) | undefined;
  if (group.nm === name) return own ? [own] : [];
  for (const child of group.it ?? []) {
    const found = shapeTransforms(child, name);
    if (found) return own ? [...found, own] : found;
  }
  return undefined;
};

const expectSamePoint = (actual: number[], expected: number[]) => {
  expect(
    Math.hypot(actual[0] - expected[0], actual[1] - expected[1]),
  ).toBeLessThan(0.1);
};

const characterTransforms = (layer: NativeLayer, group: string) => {
  const art = layer.shapes.find((shape) => shape.nm === layer.nm);
  if (!art) throw new Error(`Missing ${layer.nm} artwork`);
  const transforms = shapeTransforms(art, group);
  if (!transforms) throw new Error(`Missing ${layer.nm}/${group} joint`);
  return transforms;
};

const applyTransforms = (
  point: number[],
  transforms: NativeTransform[],
  seconds: number,
) =>
  transforms.reduce(
    (position, transform) => transformPoint(position, transform, seconds),
    point,
  );

const pathVertexAt = (keys: PathKeyframe[], vertex: number, seconds: number) =>
  numericAt(
    {
      a: 1,
      k: keys.map(({ s, e, ...key }) => ({
        ...key,
        s: s[0].v[vertex],
        e: e?.[0].v[vertex],
      })),
    },
    seconds,
  );

const distance = (from: number[], to: number[]) =>
  Math.hypot(to[0] - from[0], to[1] - from[1]);

describe('Gift wrapping composition', () => {
  it.each([360, 900, 1280, 1920])(
    'authors bounded native vectors at %ipx in either direction',
    (width) => {
      for (const rtl of [false, true]) {
        const { animationData } = buildGiftWrappingComposition(
          target(width, rtl),
          width < 1280,
        );
        expect((animationData.op / animationData.fr) * 1000).toBe(
          GIFT_WRAPPING_MS,
        );
        expect(animationData.layers.length).toBeLessThanOrEqual(12);
        expect(animationData.assets).toEqual([]);
        expect(JSON.stringify(animationData).length).toBeLessThan(240000);
        expect(JSON.stringify(elves).length).toBeLessThan(80000);
        let keyframes = 0;
        const visit = (value: unknown) => {
          if (typeof value === 'number')
            expect(Number.isFinite(value)).toBe(true);
          if (!value || typeof value !== 'object') return;
          if (
            'a' in value &&
            value.a === 1 &&
            'k' in value &&
            Array.isArray(value.k)
          ) {
            keyframes += value.k.length;
            const times = value.k.map((key) => key.t);
            expect(times).toEqual([...times].sort((a, b) => a - b));
            expect(
              times.every((time) => time >= 0 && time <= animationData.op),
            ).toBe(true);
          }
          expect(value).not.toHaveProperty('ef');
          expect(value).not.toHaveProperty('masksProperties');
          Object.values(value).forEach(visit);
        };
        visit(animationData);
        expect(keyframes).toBeLessThanOrEqual(1400);
      }
    },
  );

  it('mirrors geometry without tweening a character through zero width', () => {
    const ltr = buildGiftWrappingComposition(target(1280), false).animationData;
    const rtl = buildGiftWrappingComposition(
      target(1280, true),
      false,
    ).animationData;
    for (const name of ['master', 'helper']) {
      const left = ltr.layers.find((layer) => layer.nm === name)!;
      const right = rtl.layers.find((layer) => layer.nm === name)!;
      expect(left.ks.s.a).toBe(0);
      expect(right.ks.s.a).toBe(0);
      const [lx, ly] = left.ks.s.k as number[];
      const [rx, ry] = right.ks.s.k as number[];
      expect(lx).toBe(-rx);
      expect(ly).toBe(ry);
      expect(Math.abs(lx)).toBe(ly);
      const positions = (k: unknown) => k as { s: number[] }[];
      positions(left.ks.p.k).forEach((frame, index) => {
        const opposite = positions(right.ks.p.k)[index].s;
        expect(frame.s[0] + opposite[0]).toBeCloseTo(2 * (400 + 560 / 2));
        expect(frame.s[1]).toBe(opposite[1]);
      });
    }
  });

  it('winds consecutive ribbon turns in front of and behind the same body', () => {
    const { layers } = buildGiftWrappingComposition(
      target(1280),
      false,
    ).animationData;
    const master = layers.find((layer) => layer.nm === 'master')!;
    const body = master.shapes.findIndex((shape) => shape.nm === 'master');
    const turns = master.shapes
      .filter((shape) => shape.nm?.startsWith('coil-'))
      .sort(
        (a, b) =>
          Number(a.nm?.split('-').at(-1)) - Number(b.nm?.split('-').at(-1)),
      );
    expect(turns).toHaveLength(8);
    let previousEnd: number[] | undefined;
    let previousFinish: number | undefined;
    for (const turn of turns) {
      const path = pathOf(turn);
      const position = master.shapes.indexOf(turn);
      if (turn.nm?.includes('-front-')) expect(position).toBeLessThan(body);
      else expect(position).toBeGreaterThan(body);
      const trim = turn.it?.find((shape) => shape.ty === 'tm');
      const end = (trim?.e as { k: NumericKeyframe[] }).k;
      const begin = end.filter((key) => key.s[0] === 0).at(-1)!;
      const finish = end.find((key) => key.s[0] === 100)!;
      if (previousEnd) expectSamePoint(path.v[0], previousEnd);
      if (previousFinish !== undefined)
        expect(begin.t).toBeCloseTo(previousFinish, 6);
      expect(finish.t).toBeGreaterThan(begin.t);
      previousEnd = path.v.at(-1);
      previousFinish = finish.t;
    }
  });

  it.each([360, 900, 1280, 1920])(
    'keeps compact arms joined and bending outward throughout playback at %ipx',
    (width) => {
      for (const rtl of [false, true]) {
        const { layers } = buildGiftWrappingComposition(
          target(width, rtl),
          width < 1280,
        ).animationData;
        for (const name of ['master', 'helper']) {
          const actor = layers.find((layer) => layer.nm === name);
          if (!actor) throw new Error(`Missing ${name}`);
          const root = characterTransforms(actor, name);
          const upper = characterTransforms(actor, 'upper-arm');
          const forearm = characterTransforms(actor, 'forearm');
          const times = new Set(
            Array.from({ length: 321 }, (_, index) => index / 20),
          );
          for (const rotation of [upper[0].r, forearm[0].r]) {
            if (!rotation.a) continue;
            const keys = rotation.k as NumericKeyframe[];
            keys.forEach((key, index) => {
              times.add(key.t / 60);
              if (index) times.add((keys[index - 1].t + key.t) / 120);
            });
          }
          for (const seconds of times) {
            const shoulder = applyTransforms([0, 0], upper, seconds);
            const upperEnd = applyTransforms(
              [ELF_RIG.upperArmLength, 0],
              upper,
              seconds,
            );
            const elbow = applyTransforms([0, 0], forearm, seconds);
            const palm = applyTransforms(
              [ELF_RIG.palm.x, ELF_RIG.palm.y],
              forearm,
              seconds,
            );
            expectSamePoint(
              shoulder,
              applyTransforms(
                [ELF_RIG.shoulder.x, ELF_RIG.shoulder.y],
                root,
                seconds,
              ),
            );
            expectSamePoint(upperEnd, elbow);
            expect(distance(shoulder, elbow)).toBeCloseTo(
              ELF_RIG.upperArmLength,
              5,
            );
            expect(distance(elbow, palm)).toBeCloseTo(
              Math.hypot(ELF_RIG.palm.x, ELF_RIG.palm.y),
              5,
            );
            expect(distance(shoulder, palm)).toBeLessThanOrEqual(37.01);

            /* Use emitted local geometry, before the actor's RTL/facing mirror.
               Positive bend prevents the elbow flipping to the other side. */
            const a = [elbow[0] - shoulder[0], elbow[1] - shoulder[1]];
            const b = [palm[0] - elbow[0], palm[1] - elbow[1]];
            const bend =
              (Math.atan2(
                a[0] * b[1] - a[1] * b[0],
                a[0] * b[0] + a[1] * b[1],
              ) *
                180) /
              Math.PI;
            expect(bend).toBeGreaterThanOrEqual(20 - 1e-6);
            expect(bend).toBeLessThanOrEqual(120 + 1e-6);
            if (
              seconds <= 1.25 ||
              seconds >= 12 ||
              (name === 'helper' && seconds >= 9.2)
            ) {
              expect(palm[1]).toBeGreaterThan(shoulder[1]);
              expect(Math.abs(palm[0] - shoulder[0])).toBeLessThan(20);
            }

            const scale = Math.abs(numericAt(actor.ks.s, seconds)[0]) / 100;
            const onStage = (point: number[]) =>
              transformPoint(point, actor.ks, seconds);
            expectSamePoint(onStage(upperEnd), onStage(elbow));
            expect(distance(onStage(shoulder), onStage(elbow))).toBeCloseTo(
              ELF_RIG.upperArmLength * scale,
              5,
            );
          }
        }
      }
    },
  );

  it('switches complete facial expressions without overlapping eyes or mouths', () => {
    const { layers } = buildGiftWrappingComposition(
      target(360),
      true,
    ).animationData;
    for (const name of ['master', 'helper']) {
      const actor = layers.find((layer) => layer.nm === name);
      if (!actor) throw new Error(`Missing ${name}`);
      const names =
        name === 'master'
          ? ['expression', 'surprise', 'annoyed']
          : ['expression', 'surprise'];
      const opacities = names.map(
        (expression) => characterTransforms(actor, expression)[0].o,
      );
      const times = new Set(
        Array.from({ length: 321 }, (_, index) => index / 20),
      );
      for (const opacity of opacities) {
        const keys = opacity.k as NumericKeyframe[];
        keys.forEach((key, index) => {
          times.add(key.t / 60);
          if (index) times.add((keys[index - 1].t + key.t) / 120);
        });
      }
      for (const seconds of times) {
        const values = opacities.map(
          (opacity) => numericAt(opacity, seconds)[0],
        );
        expect(values.every((value) => value === 0 || value === 100)).toBe(
          true,
        );
        expect(values.reduce((sum, value) => sum + value, 0)).toBe(100);
      }
    }
  });

  it.each(
    [360, 900, 1280, 1920].flatMap((width) =>
      [false, true].map((rtl) => ({ width, rtl })),
    ),
  )(
    'keeps the loose end on each winding turn and the helper grip at $width px, RTL=$rtl',
    ({ width, rtl }) => {
      const { layers } = buildGiftWrappingComposition(
        target(width, rtl),
        width < 1280,
      ).animationData;
      const master = layers.find((layer) => layer.nm === 'master')!;
      const helper = layers.find((layer) => layer.nm === 'helper')!;
      const loose = layers.find((layer) => layer.nm === 'loose-ribbon')!;
      const keys = (
        loose.shapes[0].it?.find((shape) => shape.ty === 'sh')?.ks as {
          k: PathKeyframe[];
        }
      ).k;
      const turns = master.shapes.filter((shape) =>
        shape.nm?.startsWith('coil-'),
      );
      for (const turn of turns) {
        const trim = turn.it?.find((shape) => shape.ty === 'tm');
        const end = (trim?.e as { k: NumericKeyframe[] }).k;
        for (const percent of [0, 100]) {
          const frame = percent
            ? end.find((key) => key.s[0] === percent)!
            : end.filter((key) => key.s[0] === percent).at(-1)!;
          const seconds = frame.t / 60;
          const vertex = percent ? pathOf(turn).v.at(-1)! : pathOf(turn).v[0];
          const expected = transformPoint(vertex, master.ks, seconds);
          const actual = transformPoint(
            pathVertexAt(keys, 0, seconds),
            loose.ks,
            seconds,
          );
          expectSamePoint(actual, expected);
        }
      }
      const arm = characterTransforms(helper, 'forearm');
      const reel = characterTransforms(helper, 'reel');
      /* Include midpoints of the sampled ribbon keys, not only authored frames,
         so an easing mismatch cannot detach the ribbon between passing poses. */
      const times = new Set([1.8, 5.2, 6.35, 6.65, 7.8, 8.3]);
      for (let index = 0; index < keys.length; index++) {
        times.add(keys[index].t / 60);
        if (index) times.add((keys[index - 1].t + keys[index].t) / 120);
      }
      for (const seconds of times) {
        const palm = applyTransforms(
          [ELF_RIG.palm.x, ELF_RIG.palm.y],
          [...arm, helper.ks],
          seconds,
        );
        const ribbon = transformPoint(
          pathVertexAt(keys, 1, seconds),
          loose.ks,
          seconds,
        );
        expectSamePoint(ribbon, palm);
        expectSamePoint(
          transformPoint(pathVertexAt(keys, 2, seconds), loose.ks, seconds),
          applyTransforms([0, 0], [...reel, helper.ks], seconds),
        );
      }
    },
  );

  it('keeps a fresh composition per playback so the player cannot mutate future runs', () => {
    const first = buildGiftWrappingComposition(target(1280), false);
    const before = JSON.stringify(first.animationData);
    first.animationData.layers[0].shapes.length = 0;
    expect(
      JSON.stringify(
        buildGiftWrappingComposition(target(1280), false).animationData,
      ),
    ).toBe(before);
  });

  it('keeps the load, readiness and playback budget inside the provider lifetime', () => {
    const { loadTimeoutMs, readyTimeoutMs, playbackMs } = GIFT_WRAPPING_TIMINGS;
    expect({ loadTimeoutMs, readyTimeoutMs, playbackMs }).toEqual({
      loadTimeoutMs: 2000,
      readyTimeoutMs: 250,
      playbackMs: GIFT_WRAPPING_MS,
    });
    expect(GIFT_WRAPPING_MS).toBe(16000);
    expect(loadTimeoutMs + readyTimeoutMs + playbackMs).toBeLessThanOrEqual(
      NEW_YEAR_SCENE_DURATIONS[NewYearScene.GiftWrapping],
    );
    expect(NEW_YEAR_SCENE_DURATIONS[NewYearScene.GiftWrapping]).toBe(18500);
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

  it.each([
    { mobile: true, width: 360, clearance: 132 },
    { mobile: false, width: 1280, clearance: 164 },
  ])(
    'reserves room for the jumping cap near the viewport top, mobile=$mobile',
    ({ mobile, width, clearance }) => {
      vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
        width,
      );
      const left = mobile ? 16 : 400;
      const boxWidth = mobile ? 328 : 560;
      vi.mocked(fixture.getBoundingClientRect).mockReturnValue(
        new DOMRect(left, clearance - 1, boxWidth, 100),
      );
      expect(
        getGiftWrappingTarget({ composer: 'gift-composer' }, mobile).source,
      ).toBeNull();
      vi.mocked(fixture.getBoundingClientRect).mockReturnValue(
        new DOMRect(left, clearance, boxWidth, 100),
      );
      expect(
        getGiftWrappingTarget({ composer: 'gift-composer' }, mobile).source
          ?.element,
      ).toBe(fixture);
    },
  );
});
