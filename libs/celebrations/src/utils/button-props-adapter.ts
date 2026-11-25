import type { CelebrationAnchors } from '../models/celebration';
import type { CelebrationComposerAnchorPlacement } from '../models/celebration-pack';
import type {
  LottieComposition,
  LottieLayer,
  LottieProperty,
} from '../models/lottie-composition';
import type {
  LottieAnimationContext,
  LottiePlaybackStartContext,
} from '../models/lottie-scene';
import { PackSceneCompanionKind } from '../types/pack-scene';
import { findBorrowTargets } from './borrow-targets';
import type { PackScenePreparation } from './celebration-pack-scene';
import {
  prepareCelebrationSnapshots,
  type CelebrationSnapshotTarget,
} from './celebration-snapshots';
import {
  rebaseStageOntoViewport,
  resolveComposerAnchor,
} from './composer-anchor';
import { observeSceneTargets } from './scene-targets';

interface Key {
  t: number;
  s: number[];
}

const fail: (reason: string) => never = (reason) => {
  throw new TypeError(`Malformed button props: ${reason}`);
};
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const fixed = (property: LottieProperty | undefined, value: unknown) =>
  property?.a === 0 && same(property.k, value);

const keys = (
  property: LottieProperty | undefined,
  dimensions: number,
  end: number,
): Key[] => {
  if (property?.a !== 1 || !Array.isArray(property.k))
    return fail('expected animated track');
  const track = property.k as Key[];
  if (track.length < 2 || track.length > 128) fail('track exceeds key budget');
  track.forEach((key, index) => {
    if (
      !key ||
      !Number.isFinite(key.t) ||
      key.t < 0 ||
      key.t > end ||
      (index > 0 && key.t <= track[index - 1].t) ||
      !Array.isArray(key.s) ||
      key.s.length !== dimensions ||
      !key.s.every(Number.isFinite) ||
      Object.keys(key).some((name) => !['t', 's', 'i', 'o'].includes(name))
    )
      fail('invalid key');
    const curve = key as Key & { i?: unknown; o?: unknown };
    if (curve.i != null || curve.o != null) {
      if (
        !same(curve.i, { x: [1], y: [1] }) ||
        !same(curve.o, { x: [0], y: [0] })
      )
        fail('contact tracks must be linear');
    }
  });
  if (track[0].t !== 0 || track.at(-1)?.t !== end)
    fail('track must cover the composition');
  return track;
};

const nullLayer = (
  data: LottieComposition,
  name: string,
  parent?: number,
): LottieLayer => {
  const matches = data.layers.filter((layer) => layer.nm === name);
  if (matches.length !== 1) return fail(`expected one ${name}`);
  const [layer] = matches;
  if (
    layer.ty !== 3 ||
    !Number.isInteger(layer.ind) ||
    layer.parent !== parent ||
    !fixed(layer.ks?.a, [0, 0, 0]) ||
    !fixed(layer.ks?.s, [100, 100, 100]) ||
    !fixed(layer.ks?.r, 0) ||
    layer.tm != null ||
    (layer.st != null && layer.st !== 0) ||
    (layer.sr != null && layer.sr !== 1) ||
    layer.ks?.sk != null ||
    layer.ks?.sa != null ||
    (layer.ao != null && layer.ao !== 0)
  )
    fail(`invalid ${name} transform`);
  return layer;
};

const artworkBounds = (data: LottieComposition): number[][] => {
  const names = ['bp-bounds:min', 'bp-bounds:max'];
  if (!data.layers.some(({ nm }) => names.includes(nm ?? '')))
    return [
      [0, 0, 0],
      [data.w, data.h, 0],
    ];
  const corners = names.map((name) => {
    const layer = nullLayer(data, name);
    const point = layer.ks?.p?.k as number[];
    if (
      layer.ks?.p?.a !== 0 ||
      !Array.isArray(point) ||
      point.length !== 3 ||
      !point.every(Number.isFinite) ||
      point[2] !== 0 ||
      !fixed(layer.ks?.o, 0)
    )
      fail('invalid artwork bounds');
    return point;
  });
  const [min, max] = corners;
  if (
    min[0] < 0 ||
    min[1] < 0 ||
    max[0] > data.w ||
    max[1] > data.h ||
    min[0] >= max[0] ||
    min[1] >= max[1]
  )
    fail('artwork bounds outside composition');
  return corners;
};

const safeTarget = ({ element, rect }: CelebrationSnapshotTarget): boolean => {
  if (
    rect.width > 64 ||
    rect.height > 56 ||
    element.getElementsByTagName('*').length + 1 > 40
  )
    return false;
  let ancestor: HTMLElement | null = element;
  for (
    let depth = 0;
    ancestor && depth < 32;
    depth++, ancestor = ancestor.parentElement
  ) {
    const style = getComputedStyle(ancestor);
    if (
      (style.transform && style.transform !== 'none') ||
      [style.translate, style.rotate, style.scale, style.perspective].some(
        (value) => value && value !== 'none',
      ) ||
      (style.zoom && !['1', 'normal'].includes(style.zoom)) ||
      ancestor
        .getAnimations()
        .some(({ playState, pending }) => playState === 'running' || pending)
    )
      return false;
  }
  return !ancestor;
};

/** Binds bounded authored contact tracks and reversible small button copies. */
export const prepareButtonPropsScene = (
  source: unknown,
  placement: CelebrationComposerAnchorPlacement,
  anchors: CelebrationAnchors,
  isMobile: boolean,
): PackScenePreparation => {
  if (source == null || typeof source !== 'object') fail('invalid composition');
  const data = structuredClone(source) as LottieComposition;
  const fr = Number(data.fr);
  if (
    !Array.isArray(data.layers) ||
    ![data.w, data.h].every(
      (size) => Number.isFinite(size) && size > 0 && size <= 4096,
    ) ||
    data.layers.length > 48 ||
    data.ip !== 0 ||
    !Number.isFinite(fr) ||
    fr < 1 ||
    !Number.isFinite(data.op) ||
    data.op <= 0 ||
    data.op / fr > 26
  )
    fail('invalid composition');
  const ids = data.layers.map(({ ind }) => ind);
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !Number.isInteger(id))
  )
    fail('duplicate layer indices');
  const stage = nullLayer(data, 'bp-stage');
  for (const layer of data.layers) {
    const visited = new Set<number>();
    let parent = layer.parent;
    while (parent != null) {
      if (visited.has(parent) || parent === layer.ind) fail('cyclic hierarchy');
      visited.add(parent);
      const ancestor = data.layers.find(({ ind }) => ind === parent);
      if (!ancestor) fail('missing parent');
      parent = ancestor.parent;
    }
    if (layer.ty === 4 && !visited.has(stage.ind as number))
      fail('art must descend from the stage');
  }
  if (!fixed(stage.ks?.p, [0, 0, 0]) || !fixed(stage.ks?.o, 100))
    fail('stage must be identity');
  const count = data.layers.filter(({ nm }) =>
    nm?.startsWith('bp-reference:'),
  ).length;
  if (count < 1 || count > 2) fail('expected one or two props');
  const markers = data.markers as { cm: string; tm: number; dr: number }[];
  if (!Array.isArray(markers)) fail('missing markers');
  const marker = (name: string) => {
    const matches = markers.filter(({ cm }) => cm === name);
    if (
      matches.length !== 1 ||
      !Number.isFinite(matches[0].tm) ||
      matches[0].dr !== 0
    )
      return fail(`invalid ${name}`);
    return matches[0].tm;
  };
  const props = Array.from({ length: count }, (_, index) => {
    const reference = nullLayer(data, `bp-reference:${index}`);
    const ref = reference.ks?.p?.k as number[];
    if (
      reference.ks?.p?.a !== 0 ||
      !Array.isArray(ref) ||
      ref.length !== 3 ||
      !ref.every(Number.isFinite) ||
      ref[2] !== 0
    )
      fail('invalid reference');
    const weight = nullLayer(data, `bp-weight:${index}`);
    if (!fixed(weight.ks?.p, [0, 0, 0]))
      fail('weight position must be identity');
    const weights = keys(weight.ks?.o, 1, data.op);
    const prop = nullLayer(data, `bp-prop:${index}`, stage.ind);
    const positions = keys(prop.ks?.p, 3, data.op);
    const opacity = keys(prop.ks?.o, 1, data.op);
    for (const track of [positions, opacity])
      if (
        !same(
          track.map(({ t }) => t),
          weights.map(({ t }) => t),
        )
      )
        fail('tracks must share key times');
    if (
      positions.some(
        ({ s }) =>
          s[2] !== 0 || Math.abs(s[0]) > data.w || Math.abs(s[1]) > data.h,
      ) ||
      [...opacity, ...weights].some(({ s }) => s[0] < 0 || s[0] > 100)
    )
      fail('track outside bounds');
    const entry = marker(`bp:entry:${index}`);
    const restore = marker(`bp:restore:${index}`);
    if (
      entry < data.op * 0.02 ||
      restore <= entry ||
      restore > data.op - fr * 0.25
    )
      fail('invalid borrowing interval');
    for (const frame of [entry, restore]) {
      const key = positions.findIndex(({ t }) => t === frame);
      if (key < 0 || !same(positions[key].s, ref) || weights[key].s[0] !== 100)
        fail('prop must contact its reference at entry and return');
    }
    if (
      opacity.some(
        ({ t, s }) =>
          (t < entry - fr * 0.2 || t > restore + fr * 0.2) && s[0] !== 0,
      )
    )
      fail('copy visible outside borrowing interval');
    return {
      reference,
      weight,
      prop,
      ref,
      weights,
      positions,
      opacity,
      entry,
      restore,
    };
  });
  const times = props[0].weights.map(({ t }) => t);
  if (
    props.some(
      ({ weights }) =>
        !same(
          weights.map(({ t }) => t),
          times,
        ),
    )
  )
    fail('props must share contact times');
  if (
    times.some(
      (_, i) =>
        props.reduce((total, prop) => total + prop.weights[i].s[0], 0) > 100,
    )
  )
    fail('overlapping contacts');
  const mapping = resolveComposerAnchor(placement, anchors.composer, false);
  if (!mapping) return fail('no safe stage');
  const { scale, pivot, origin } = mapping;
  const bounds = artworkBounds(data);
  const fitsViewport = (delta: number[]) =>
    bounds.every(([x, y]) => {
      const left = origin.x + (x + delta[0] - pivot.x) * scale;
      const top = origin.y + (y + delta[1] - pivot.y) * scale;
      return (
        left >= 0 &&
        left <= mapping.viewportWidth &&
        top >= 0 &&
        top <= mapping.viewportHeight
      );
    });
  if (!fitsViewport([0, 0])) return fail('no safe artwork stage');
  const contactDelta = (target: CelebrationSnapshotTarget, ref: number[]) => [
    pivot.x +
      (target.rect.left + target.rect.width / 2 - origin.x) / scale -
      ref[0],
    pivot.y +
      (target.rect.top + target.rect.height / 2 - origin.y) / scale -
      ref[1],
  ];
  const availableProps = props.slice(0, isMobile ? 1 : 2);
  const canBorrow = (target: CelebrationSnapshotTarget) =>
    safeTarget(target) &&
    availableProps.every(({ ref }) => {
      const delta = contactDelta(target, ref);
      return (
        Math.abs(delta[0]) <= 400 &&
        Math.abs(delta[1]) <= 140 &&
        fitsViewport(delta)
      );
    });
  /* Every accepted slot translation and zero fit the same rectangle. Contact
     weights are nonnegative and total at most one, so their linear blend also
     fits throughout playback, without measuring or clamping individual frames. */
  const candidates = mapping.source
    ? findBorrowTargets(
        anchors,
        mapping.source.element,
        canBorrow,
      ).buttons.slice(0, isMobile ? 1 : 2)
    : [];
  const bound = props.map((prop, index) => {
    const target = candidates[index];
    return {
      ...prop,
      target,
      delta: target ? contactDelta(target, prop.ref) : [0, 0],
    };
  });
  const offsets = times.map((_, key) =>
    bound.reduce(
      (sum, prop) => [
        sum[0] + (prop.delta[0] * prop.weights[key].s[0]) / 100,
        sum[1] + (prop.delta[1] * prop.weights[key].s[0]) / 100,
        0,
      ],
      [0, 0, 0],
    ),
  );
  stage.ks = {
    ...stage.ks,
    p: {
      a: 1,
      k: times.map((t, i) => ({
        t,
        s: offsets[i],
        o: { x: [0], y: [0] },
        i: { x: [1], y: [1] },
      })),
    },
  };
  data.layers = data.layers.filter(
    (layer) =>
      !bound.some(
        (prop, index) => prop.target && layer.nm === `bp-drawn:${index}`,
      ),
  );
  const durationMs = (data.op / fr) * 1000;
  const borrowed = bound.flatMap((prop) =>
    prop.target ? [{ ...prop, target: prop.target }] : [],
  );
  const copies = borrowed.map((prop) => {
    const target = prop.target;
    const center = [
      target.rect.left + target.rect.width / 2,
      target.rect.top + target.rect.height / 2,
    ];
    const frames = prop.positions.map(({ t, s }, i) => ({
      offset: t / data.op,
      easing: 'linear',
      opacity: prop.opacity[i].s[0] / 100,
      transform: `translate(${origin.x + (s[0] + offsets[i][0] - pivot.x) * scale - center[0]}px, ${origin.y + (s[1] + offsets[i][1] - pivot.y) * scale - center[1]}px)`,
    }));
    return prepareCelebrationSnapshots([target], {
      durationMs,
      hideAt: prop.entry / data.op,
      restoreAt: prop.restore / data.op,
      restoreShare: 0.2 / (data.op / fr),
      frames: () => frames,
    });
  });
  return {
    data: rebaseStageOntoViewport(data, mapping),
    aspectRatio: data.w / data.h,
    anchor: mapping,
    companion: {
      kind: PackSceneCompanionKind.ButtonProps,
      copies,
      watched: borrowed.map(({ target }) => target),
    },
  };
};

/** Attaches inert copies and watches their original buttons until disposal. */
export const onButtonPropsAnimationCreated = ({
  preparation,
  host,
  addDisposer,
  cancel,
}: LottieAnimationContext<PackScenePreparation>): void => {
  const props = preparation.companion;
  if (props?.kind !== PackSceneCompanionKind.ButtonProps) return;
  const layer = document.createElement('div');
  layer.dataset.buttonPropsCopies = '';
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;
  Object.assign(layer.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
  });
  addDisposer(() => {
    props.copies.forEach((copy) => copy.stop());
    layer.remove();
  });
  host.prepend(layer);
  props.copies.forEach((copy) => copy.attach(layer));
  addDisposer(observeSceneTargets(props.watched, cancel, [host]));
};

/** Starts all prop copies at the renderer's timeline zero. */
export const onButtonPropsPlaybackStarted = ({
  preparation,
  timelineZeroMs,
}: LottiePlaybackStartContext<PackScenePreparation>): void => {
  if (preparation.companion?.kind === PackSceneCompanionKind.ButtonProps)
    preparation.companion.copies.forEach((copy) => copy.start(timelineZeroMs));
};
