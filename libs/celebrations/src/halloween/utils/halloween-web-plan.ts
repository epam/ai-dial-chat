import {
  HALLOWEEN_MOBILE_WEB_COUNT,
  HALLOWEEN_WEB_COUNT,
} from '../constants/halloween';

export interface Point {
  x: number;
  y: number;
}

export interface HalloweenWebThread {
  points: Point[];
  delayMs: number;
  durationMs: number;
  from?: number;
  to?: number;
}

export interface HalloweenWeavingSpider extends Point {
  spiderSize: number;
  delayMs: number;
  weaveMs: number;
  escapeDelayMs: number;
  escapeMs: number;
  escape: Point;
  spokes: Point[][];
  silk: Point[];
  targetIndex?: number;
}

export interface HalloweenWebPlan {
  width: number;
  height: number;
  webs: HalloweenWeavingSpider[];
  strands: HalloweenWebThread[];
}

interface TargetRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface WebAnchor extends Point {
  fan?: {
    targetIndex: number;
    directionX: number;
    directionY: number;
    radius: number;
  };
}

const SPOKES = 12;
const SAMPLES_PER_SECTOR = 5;
const between = (minimum: number, maximum: number) =>
  minimum + Math.random() * (maximum - minimum);
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));
const shuffled = <T>(values: T[]): T[] => {
  for (let index = values.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [values[index], values[swap]] = [values[swap], values[index]];
  }
  return values;
};

/** Preserve the coverage grid; borrow only nearby, previously unused anchors. */
const attachTargets = (
  anchors: WebAnchor[],
  targets: readonly TargetRect[],
  width: number,
  height: number,
  cellDiagonal: number,
  normalRadius: number,
  maximumRadius: number,
) => {
  const available = new Set(anchors.map((_, index) => index));
  const eligible = targets
    .map((target, targetIndex) => {
      if (
        ![target.left, target.top, target.width, target.height].every(
          Number.isFinite,
        )
      )
        return null;
      const left = Math.max(0, target.left);
      const top = Math.max(0, target.top);
      const right = Math.min(width, target.left + target.width);
      const bottom = Math.min(height, target.top + target.height);
      if (right - left < 16 || bottom - top < 16) return null;
      const inset = Math.min(6, (right - left) / 8, (bottom - top) / 8);
      return {
        targetIndex,
        radius: Math.min(
          normalRadius * between(0.85, 1.15),
          maximumRadius,
          (right - left - inset * 2) * 0.9,
          (bottom - top - inset * 2) * 0.9,
        ),
        corners: shuffled([
          { x: left + inset, y: top + inset, directionX: 1, directionY: 1 },
          { x: right - inset, y: top + inset, directionX: -1, directionY: 1 },
          {
            x: right - inset,
            y: bottom - inset,
            directionX: -1,
            directionY: -1,
          },
          { x: left + inset, y: bottom - inset, directionX: 1, directionY: -1 },
        ]),
      };
    })
    .filter((target) => target !== null)
    .slice(0, 12);

  /* Give every visible target one web before spending spare anchors on a
     second corner. A distant second corner must not empty another screen area. */
  for (let corner = 0; corner < 2; corner++) {
    for (const target of eligible) {
      const destination = target.corners[corner];
      let closest: number | undefined;
      let distance = Infinity;
      for (const index of available) {
        const candidate = Math.hypot(
          anchors[index].x - destination.x,
          anchors[index].y - destination.y,
        );
        if (candidate < distance) {
          closest = index;
          distance = candidate;
        }
      }
      if (closest === undefined || (corner === 1 && distance > cellDiagonal))
        continue;
      available.delete(closest);
      anchors[closest] = {
        x: destination.x,
        y: destination.y,
        fan: {
          targetIndex: target.targetIndex,
          directionX: destination.directionX,
          directionY: destination.directionY,
          radius: target.radius,
        },
      };
    }
  }
};

/** Pre-sample tensioned silk once; rendering and the spider use the same points. */
const buildSilk = (anchor: WebAnchor, radius: number) => {
  const turns = Math.random() < 0.5 ? 5 : 6;
  const rotation = between(0, Math.PI * 2);
  const sag = between(0.08, 0.16);
  const phase = between(0, Math.PI * 2);
  const fan = anchor.fan;
  const sector = fan ? Math.PI / (2 * (SPOKES - 1)) : (Math.PI * 2) / SPOKES;
  const outerRadius = (angle: number) =>
    radius *
    (0.91 +
      0.05 * Math.sin(angle * 3 + phase) +
      0.035 * Math.cos(angle * 5 + phase));
  const at = (angle: number, distance: number): Point => ({
    x: anchor.x + Math.cos(angle) * distance * (fan?.directionX ?? 1),
    y: anchor.y + Math.sin(angle) * distance * (fan?.directionY ?? 1),
  });
  const spokes = Array.from({ length: SPOKES }, (_, index) => {
    const angle = (fan ? 0 : rotation) + index * sector;
    return [{ x: anchor.x, y: anchor.y }, at(angle, outerRadius(angle))];
  });
  const steps = turns * (fan ? SPOKES - 1 : SPOKES) * SAMPLES_PER_SECTOR;
  const silk = Array.from({ length: steps + 1 }, (_, index) => {
    const progress = index / steps;
    const turn = progress * turns;
    let angle: number;
    if (fan) {
      const sweep = Math.min(Math.floor(turn), turns - 1);
      const local = turn - sweep;
      const eased = (1 - Math.cos(local * Math.PI)) / 2;
      angle = ((sweep % 2 ? 1 - eased : eased) * Math.PI) / 2;
    } else {
      angle = rotation + turn * Math.PI * 2;
    }
    const positionInSector = ((angle - (fan ? 0 : rotation)) / sector) % 1;
    const scallop = 1 - sag * Math.sin(positionInSector * Math.PI);
    return at(angle, outerRadius(angle) * progress * scallop);
  });
  return { spokes, silk };
};

const escapePoint = (width: number, height: number, size: number): Point => {
  const margin = size * 2;
  switch (Math.floor(Math.random() * 4)) {
    case 0:
      return { x: -margin, y: between(0, height) };
    case 1:
      return { x: width + margin, y: between(0, height) };
    case 2:
      return { x: between(0, width), y: -margin };
    default:
      return { x: between(0, width), y: height + margin };
  }
};

/** Quadratic silk bridges retain common endpoints while varying their sag. */
const connect = (
  webs: HalloweenWeavingSpider[],
  strands: HalloweenWebThread[],
  from: number,
  to: number,
  width: number,
  height: number,
) => {
  const a = webs[from];
  const b = webs[to];
  const count = Math.random() < 0.65 ? 2 : 1;
  for (let thread = 0; thread < count; thread++) {
    const bend = between(-0.16, 0.16) + thread * 0.08;
    const control = {
      x: clamp((a.x + b.x) / 2 - (b.y - a.y) * bend, 0, width),
      y: clamp((a.y + b.y) / 2 + (b.x - a.x) * bend, 0, height),
    };
    strands.push({
      from,
      to,
      delayMs: Math.min(a.delayMs, b.delayMs) + between(120, 650),
      durationMs: between(1100, 2000),
      points: Array.from({ length: 9 }, (_, index) => {
        const t = index / 8;
        const start = (1 - t) ** 2;
        const middle = 2 * (1 - t) * t;
        const end = t * t;
        return {
          x: start * a.x + middle * control.x + end * b.x,
          y: start * a.y + middle * control.y + end * b.y,
        };
      }),
    });
  }
};

/**
 * Build the whole connected viewport mesh without DOM reads or per-frame work.
 * Reposition at most two anchors per UI rectangle; retain all grid graph edges.
 */
export const buildHalloweenWebPlan = ({
  width,
  height,
  isMobile,
  targets = [],
}: {
  width: number;
  height: number;
  isMobile: boolean;
  targets?: readonly TargetRect[];
}): HalloweenWebPlan => {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return { width: 0, height: 0, webs: [], strands: [] };
  const count = isMobile ? HALLOWEEN_MOBILE_WEB_COUNT : HALLOWEEN_WEB_COUNT;
  const columns = isMobile ? 6 : 10;
  const rows = count / columns;
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const minimumRadius = isMobile ? 20 : 32;
  const maximumRadius = isMobile ? 34 : 54;
  const radius = clamp(
    Math.min(cellWidth, cellHeight) * 0.72,
    minimumRadius,
    maximumRadius,
  );
  const order = shuffled(Array.from({ length: count }, (_, index) => index));
  const anchors: WebAnchor[] = Array.from({ length: count }, (_, index) => ({
    x: ((index % columns) + between(0.15, 0.85)) * cellWidth,
    y: (Math.floor(index / columns) + between(0.15, 0.85)) * cellHeight,
  }));
  attachTargets(
    anchors,
    targets,
    width,
    height,
    Math.hypot(cellWidth, cellHeight),
    radius,
    maximumRadius,
  );
  const webs = anchors.map((anchor, index): HalloweenWeavingSpider => {
    const delayMs = (order[index] / (count - 1)) * 4200;
    const weaveMs = between(2800, 4100);
    const spiderSize = isMobile ? between(16, 21) : between(21, 27);
    const webRadius =
      anchor.fan?.radius ??
      Math.min(
        clamp(radius * between(0.85, 1.15), minimumRadius, maximumRadius),
        anchor.x,
        width - anchor.x,
        anchor.y,
        height - anchor.y,
      );
    return {
      x: anchor.x,
      y: anchor.y,
      targetIndex: anchor.fan?.targetIndex,
      spiderSize,
      delayMs,
      weaveMs,
      escapeDelayMs: Math.max(
        9300 + between(0, 1100),
        delayMs + 800 + weaveMs + 350,
      ),
      escapeMs: between(1600, 2600),
      escape: escapePoint(width, height, spiderSize),
      ...buildSilk(anchor, webRadius),
    };
  });
  const strands: HalloweenWebThread[] = [];
  webs.forEach((_, index) => {
    const column = index % columns;
    if (column < columns - 1)
      connect(webs, strands, index, index + 1, width, height);
    if (index + columns < count) {
      connect(webs, strands, index, index + columns, width, height);
      if (column < columns - 1) {
        if (Math.random() < 0.5)
          connect(webs, strands, index, index + columns + 1, width, height);
        else connect(webs, strands, index + 1, index + columns, width, height);
      }
    }
  });
  return { width, height, webs, strands };
};
