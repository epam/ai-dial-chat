/* The S7 batch 1 gate on data (design D10): both SnowmanDelivery variants
   prepared by the adapter against synthetic hosts, in every section, with the
   prepared properties evaluated at the marker frames, and the stage choice
   compared with the compiled solver on the same hosts. There is no browser run. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CelebrationAnchors } from '../../models/celebration';
import type {
  CelebrationComposerAnchorPlacement,
  CelebrationTextDirection,
} from '../../models/celebration-pack';
import { SnowmanStage } from '../../new-year/types/new-year';
import { getSnowmanDeliveryTargets } from '../../new-year/utils/snowman-delivery-targets';
import snowmanDesktop from '../../stories/fixtures/copy-track-snowman.desktop.lottie.json';
import snowmanMobile from '../../stories/fixtures/copy-track-snowman.mobile.lottie.json';
import {
  CelebrationAnchor,
  CelebrationAnchorEdge,
  CelebrationAnchorFallback,
  CelebrationPlacementTemplate,
} from '../../types/celebration-pack';
import { CopyTrackSectionKind } from '../../types/copy-track';
import { prepareCopyTrackScene } from '../copy-track-adapter';

const captured = vi.hoisted(() => ({
  frames: [] as Keyframe[],
  travel: [] as Keyframe[],
  section: null as string | null,
}));
vi.mock('../celebration-snapshots', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../celebration-snapshots')>();
  return {
    ...actual,
    prepareCelebrationSnapshots: (
      targets: { rect: DOMRect }[],
      options: Parameters<typeof actual.prepareCelebrationSnapshots>[1],
    ) => {
      captured.frames = options.frames(targets[0].rect, 0);
      captured.travel = options.travelFrames?.(0) ?? [];
      return { attach: vi.fn(), start: vi.fn(), stop: vi.fn() };
    },
  };
});
vi.mock('../copy-track-stages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../copy-track-stages')>();
  return {
    ...actual,
    chooseCopyTrackSection: (
      ...args: Parameters<typeof actual.chooseCopyTrackSection>
    ) => {
      const chosen = actual.chooseCopyTrackSection(...args);
      captured.section = chosen?.section.kind ?? null;
      return chosen;
    },
  };
});

const FPS = 60;

/* ---------- evaluating Lottie properties ---------- */
interface Key {
  t: number;
  s: number[];
  h?: number;
  o?: { x: number | number[]; y: number | number[] };
  i?: { x: number | number[]; y: number | number[] };
}

interface Property {
  a: number;
  k: Key[] | number[] | number;
}

interface Layer {
  nm?: string;
  ks: Record<string, Property>;
  tm?: Property;
}

interface Data {
  fr: number;
  op: number;
  layers: Layer[];
  assets: { layers: Layer[] }[];
  markers: { cm: string; tm: number; dr: number }[];
}

const first = (value: number | number[]) =>
  Array.isArray(value) ? value[0] : value;
const bezier = (x1: number, y1: number, x2: number, y2: number, x: number) => {
  const sample = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let step = 0; step < 50; step++) {
    if (sample(x1, x2, t) < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return sample(y1, y2, t);
};
const valueAt = (property: Property, frame: number): number[] => {
  if (property.a !== 1) return [property.k as number].flat() as number[];
  const keys = property.k as Key[];
  if (frame <= keys[0].t) return keys[0].s;
  for (let index = 0; index < keys.length - 1; index++) {
    const key = keys[index];
    const next = keys[index + 1];
    if (frame >= key.t && frame < next.t) {
      if (key.h === 1) return key.s;
      const share = (frame - key.t) / (next.t - key.t);
      const eased =
        key.o && key.i
          ? bezier(
              first(key.o.x),
              first(key.o.y),
              first(key.i.x),
              first(key.i.y),
              share,
            )
          : share;
      return key.s.map((value, dim) => value + (next.s[dim] - value) * eased);
    }
  }
  return keys[keys.length - 1].s;
};

type Point = { x: number; y: number };

const minus = (a: Point, b: Point) => ({ x: a.x - b.x, y: a.y - b.y });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/* ---------- the authored asset ---------- */
const NO_COPY = `#${CopyTrackSectionKind.Rim},${CopyTrackSectionKind.Platform}`;

/** Marker frames and the section path of one variant, in actor-local frames. */
const authoredOf = (data: Data) => {
  const marker = (cm: string) =>
    data.markers.find((item) => item.cm === cm) as Data['markers'][number];
  const splices = (kind: CopyTrackSectionKind) => {
    const cuts = data.markers.filter(({ cm }) => cm === `ct:cut:${kind}`);
    const fills = data.markers.filter(({ cm }) => cm === `ct:fill:${kind}`);
    return cuts.map((cut, index) => ({ cut, fill: fills[index] }));
  };
  const isNoCopy = (kind: CopyTrackSectionKind) =>
    kind === CopyTrackSectionKind.Rim || kind === CopyTrackSectionKind.Platform;
  const root = (name: string) =>
    data.layers.find(({ nm }) => nm === name) as Layer;
  const actor = (name: string) =>
    data.assets[0].layers.find(({ nm }) => nm === name) as Layer;
  return {
    marker: (cm: string) => marker(cm).tm,
    window: (slot: string) => {
      const { tm, dr } = marker(`ct:cycle-window:${slot}`);
      return { from: tm, to: tm + dr };
    },
    /** Where a trunk frame plays in the section: in a fill when a cut replaces it. */
    onPath: (kind: CopyTrackSectionKind, frame: number) => {
      const splice = splices(kind).find(
        ({ cut }) => frame >= cut.tm && frame <= cut.tm + cut.dr,
      );
      return splice ? splice.fill.tm + (frame - splice.cut.tm) : frame;
    },
    /** A track's authored stage position at a path frame, carried by the section's travel at the trunk frame. */
    track: (
      kind: CopyTrackSectionKind,
      name: string,
      pathFrame: number,
      trunkFrame: number,
    ) => {
      const travel = root(isNoCopy(kind) ? `ct-travel${NO_COPY}` : 'ct-travel');
      const [x, y] = valueAt(actor(name).ks.p, pathFrame);
      const [tx, ty] = valueAt(travel.ks.p, trunkFrame);
      return { x: x - 1000 + tx, y: y - 1000 + ty };
    },
    /** A follow group's authored position in the section's own references. */
    follow: (kind: CopyTrackSectionKind, name: string) => {
      const anchor = name.slice('ct-follow:'.length);
      const own = (base: string) =>
        (isNoCopy(kind) &&
          data.layers.find(({ nm }) => nm === `${base}${NO_COPY}`)) ||
        root(base);
      const [x, y] = valueAt(own(name).ks.p, 0);
      const [bx, by] = valueAt(root(`anchor:${anchor}`).ks.p, 0);
      const [sx, sy] = valueAt(own(`anchor:${anchor}`).ks.p, 0);
      return { x: x - bx + sx, y: y - by + sy };
    },
  };
};

/** Stage positions of a prepared scene at a composition frame. */
const preparedOf = (data: Data) => {
  const root = (name: string) =>
    data.layers.find(({ nm }) => nm === name) as Layer;
  const actorLayer = root('ct-actor');
  const travel = root('ct-travel');
  const actor = (name: string) =>
    data.assets[0].layers.find(({ nm }) => nm === name) as Layer;
  const local = (frame: number) =>
    valueAt(actorLayer.tm as Property, frame)[0] * data.fr;
  return {
    /** The first composition frame that plays `target` without a jump, linearly refined. */
    compositionOf: (target: number) => {
      const step = 0.25;
      let before = local(0);
      if (Math.abs(before - target) < 1e-6) return 0;
      for (let frame = step; frame <= data.op + step; frame += step) {
        const value = local(frame);
        const isContinuous = Math.abs(value - before) <= 8 * step;
        if (isContinuous && before <= target + 1e-6 && value >= target - 1e-6)
          return (
            frame -
            step +
            (value === before
              ? 0
              : ((target - before) / (value - before)) * step)
          );
        before = value;
      }
      throw new Error(`frame ${target} never plays`);
    },
    track: (name: string, frame: number) => {
      const [x, y] = valueAt(actor(name).ks.p, local(frame));
      const [ax, ay] = valueAt(actorLayer.ks.a, 0);
      const [px, py] = valueAt(actorLayer.ks.p, 0);
      const [tx, ty] = valueAt(travel.ks.p, frame);
      return { x: x + px - ax + tx, y: y + py - ay + ty };
    },
    follow: (name: string) => {
      const [x, y] = valueAt(root(name).ks.p, 0);
      return { x, y };
    },
  };
};

/* ---------- hosts ---------- */
type Box = [number, number, number, number];

interface Host {
  heading: Box;
  composer: Box;
  starters?: Box;
  cards?: Box[];
}

const anchors: CelebrationAnchors = {
  composer: 'composer',
  starterList: 'starters',
  welcomeRegion: '[role="region"]',
};
const placementAt = (scale: number): CelebrationComposerAnchorPlacement => ({
  template: CelebrationPlacementTemplate.ComposerAnchorV1,
  anchor: CelebrationAnchor.Composer,
  anchorRect: { x: 0, y: 0, width: 240, height: 56 },
  edge: CelebrationAnchorEdge.Top,
  scale: { min: scale, max: scale },
  fallback: CelebrationAnchorFallback.StageAnchor,
});

/* The production starter widths on the ConversationInput host (164, 151, 172 px). */
const desktopHosts = (width: number): Record<CopyTrackSectionKind, Host> => {
  const composerWidth = Math.min(700, width - 64);
  const left = (width - composerWidth) / 2;
  const middle = width / 2;
  return {
    [CopyTrackSectionKind.LedgeCard]: {
      heading: [middle - 92, 349, 184, 40],
      composer: [left, 425, composerWidth, 114],
      starters: [left + 29, 559, composerWidth - 58, 40],
      cards: [
        [middle - 251, 559, 164, 40],
        [middle - 84, 559, 151, 40],
        [middle + 76, 559, 172, 40],
      ],
    },
    [CopyTrackSectionKind.RimCard]: {
      heading: [middle - 92, 150, 184, 40],
      composer: [left, 425, composerWidth, 114],
      starters: [left + 20, 330, 164, 40],
      cards: [[left + 20, 330, 164, 40]],
    },
    [CopyTrackSectionKind.Rim]: {
      heading: [middle - 92, 150, 184, 40],
      composer: [left, 425, composerWidth, 114],
    },
    [CopyTrackSectionKind.Platform]: {
      heading: [middle - 92, 377, 184, 40],
      composer: [left, 453, composerWidth, 114],
    },
    [CopyTrackSectionKind.RimWord]: {
      heading: [0, 0, 0, 0],
      composer: [0, 0, 0, 0],
    },
  };
};
const mobileHosts = (width: number): Record<CopyTrackSectionKind, Host> => {
  const composerWidth = width - 32;
  const middle = width / 2;
  return {
    [CopyTrackSectionKind.LedgeCard]: {
      heading: [middle - 80, 160, 160, 32],
      composer: [16, 300, composerWidth, 100],
      starters: [16, 412, composerWidth, 40],
      cards: (
        [
          [16, 412, 164, 40],
          [188, 412, 151, 40],
        ] as Box[]
      ).filter(([left, , cardWidth]) => left + cardWidth <= width - 16),
    },
    [CopyTrackSectionKind.RimCard]: {
      heading: [middle - 80, 160, 160, 32],
      composer: [16, 660, composerWidth, 100],
      starters: [16, 590, 164, 40],
      cards: [[16, 590, 164, 40]],
    },
    [CopyTrackSectionKind.Rim]: {
      heading: [middle - 80, 160, 160, 32],
      composer: [16, 660, composerWidth, 100],
    },
    [CopyTrackSectionKind.Platform]: {
      heading: [16, 200, composerWidth, 32],
      composer: [16, 260, composerWidth, 100],
    },
    [CopyTrackSectionKind.RimWord]: {
      heading: [0, 0, 0, 0],
      composer: [0, 0, 0, 0],
    },
  };
};

const VARIANTS = [
  {
    variant: 'desktop',
    asset: snowmanDesktop as unknown as Data,
    isMobile: false,
    scale: 0.9,
    height: 900,
    widths: [1024, 1280, 1440, 1920],
    hosts: desktopHosts,
  },
  {
    variant: 'mobile',
    asset: snowmanMobile as unknown as Data,
    isMobile: true,
    scale: 0.68,
    height: 800,
    widths: [360, 390, 600, 900],
    hosts: mobileHosts,
  },
];
const SECTIONS = [
  CopyTrackSectionKind.LedgeCard,
  CopyTrackSectionKind.RimCard,
  CopyTrackSectionKind.Rim,
  CopyTrackSectionKind.Platform,
];
const DIRECTIONS: CelebrationTextDirection[] = ['ltr', 'rtl'];

const place = (element: HTMLElement, [left, top, width, height]: Box) =>
  vi
    .spyOn(element, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(left, top, width, height));
const build = (
  width: number,
  height: number,
  direction: CelebrationTextDirection,
  host: Host,
) => {
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
    width,
  );
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
    height,
  );
  document.documentElement.dir = direction;
  const region = document.createElement('div');
  region.setAttribute('role', 'region');
  document.body.append(region);
  const heading = document.createElement('h1');
  heading.textContent = 'Good evening!';
  region.append(heading);
  place(heading, host.heading);
  const composer = document.createElement('div');
  composer.className = 'composer';
  /* jsdom does not inherit `direction`; the compiled solver reads it from the composer. */
  composer.style.direction = direction;
  region.append(composer);
  place(composer, host.composer);
  if (!host.starters) return;
  const list = document.createElement('ul');
  list.className = 'starters';
  region.append(list);
  place(list, host.starters);
  (host.cards ?? []).forEach((box, index) => {
    const button = document.createElement('button');
    button.textContent = `Starter ${index + 1}`;
    list.append(button);
    place(button, box);
  });
};

/* The compiled stage each section stands for. */
const COMPILED_STAGE: Record<string, SnowmanStage> = {
  [CopyTrackSectionKind.LedgeCard]: SnowmanStage.Ledge,
  [CopyTrackSectionKind.RimCard]: SnowmanStage.Rim,
  [CopyTrackSectionKind.Rim]: SnowmanStage.RimSled,
  [CopyTrackSectionKind.Platform]: SnowmanStage.Platform,
};
/* Mobile card sections start at a 140 px span, where the head flight is still
   proportional to it (delta V10, issue owner 2026-11-23). On narrower phones a
   card host plays the drawn-sled rim or the poster where the compiled scene
   borrows the card. */
const STAGE_EXCEPTIONS: {
  variant: string;
  widths: number[];
  host: CopyTrackSectionKind;
  expected: CopyTrackSectionKind | null;
  compiled: Record<number, SnowmanStage>;
}[] = [
  {
    variant: 'mobile',
    widths: [360, 390],
    host: CopyTrackSectionKind.LedgeCard,
    expected: CopyTrackSectionKind.Rim,
    compiled: { 360: SnowmanStage.Ledge, 390: SnowmanStage.Ledge },
  },
  {
    variant: 'mobile',
    widths: [360, 390],
    host: CopyTrackSectionKind.RimCard,
    expected: null,
    compiled: { 360: SnowmanStage.Static, 390: SnowmanStage.Rim },
  },
];

const CELLS = VARIANTS.flatMap((variant) =>
  variant.widths.flatMap((width) =>
    DIRECTIONS.flatMap((direction) =>
      SECTIONS.map((host) => {
        const exception = STAGE_EXCEPTIONS.find(
          (item) =>
            item.variant === variant.variant &&
            item.widths.includes(width) &&
            item.host === host,
        );
        return {
          ...variant,
          width,
          direction,
          host,
          expected: exception ? exception.expected : host,
          compiled: exception?.compiled[width] ?? COMPILED_STAGE[host],
        };
      }),
    ),
  ),
);

type Cell = (typeof CELLS)[number];

const prepare = (cell: Cell) => {
  build(
    cell.width,
    cell.height,
    cell.direction,
    cell.hosts(cell.width)[cell.host],
  );
  captured.section = null;
  const preparation = prepareCopyTrackScene(
    cell.asset,
    placementAt(cell.scale),
    { anchors, isMobile: cell.isMobile, direction: cell.direction },
  );
  return {
    preparation,
    view: preparedOf(preparation.data as unknown as Data),
    authored: authoredOf(cell.asset),
  };
};

const hasCard = (section: CopyTrackSectionKind) =>
  section === CopyTrackSectionKind.LedgeCard ||
  section === CopyTrackSectionKind.RimCard;

describe('copy-track gate (design D10), on data', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: () => ({ cancel: vi.fn(), startTime: null }),
    });
  });
  afterEach(() => {
    document.body.replaceChildren();
    document.documentElement.dir = '';
    vi.restoreAllMocks();
  });

  describe.each(CELLS)('$variant $width px $direction $host host', (cell) => {
    /* The section the host gets; metric checks run only where one plays. */
    const kind = cell.expected as CopyTrackSectionKind;
    const metric = cell.expected === null ? it.skip : it;

    it('chooses the stage the compiled solver chooses for the same host', () => {
      if (cell.expected === null) expect(() => prepare(cell)).toThrow();
      else prepare(cell);
      const compiled = getSnowmanDeliveryTargets(anchors, cell.isMobile);

      expect(captured.section).toBe(cell.expected);
      expect(compiled.mode).toBe(cell.compiled);
    });

    metric('keeps every contact pair within 2 px', () => {
      const { view, authored } = prepare(cell);
      const tracks = (a: string, b: string) => ({
        prepared: [
          (frame: number) => view.track(a, frame),
          (frame: number) => view.track(b, frame),
        ],
        authored: [
          (path: number, trunk: number) => authored.track(kind, a, path, trunk),
          (path: number, trunk: number) => authored.track(kind, b, path, trunk),
        ],
      });
      const toFollow = (a: string, follow: string) => ({
        prepared: [
          (frame: number) => view.track(a, frame),
          () => view.follow(follow),
        ],
        authored: [
          (path: number, trunk: number) => authored.track(kind, a, path, trunk),
          () => authored.follow(kind, follow),
        ],
      });
      const pairs: [string, number, ReturnType<typeof tracks>][] = hasCard(kind)
        ? [
            [
              'grip: root and card',
              authored.marker('ct:contact:grip'),
              tracks('ct-track:root', 'ct-track:copy'),
            ],
            [
              'seat: root and card',
              authored.marker('ct:contact:seat'),
              tracks('ct-track:root', 'ct-track:copy'),
            ],
            [
              'impact: card and snowbank',
              authored.marker('ct:contact:impact'),
              toFollow('ct-track:copy', 'ct-follow:span-end'),
            ],
            [
              'catch: head and root',
              authored.marker('ct:contact:catch'),
              tracks('ct-track:head-free', 'ct-track:root'),
            ],
          ]
        : [
            [
              'seat: root and sled',
              authored.marker('ct:contact:seat'),
              tracks('ct-track:root', 'ct-track:sled'),
            ],
            [
              'impact: sled and snowbank',
              authored.marker('ct:contact:impact'),
              toFollow('ct-track:sled', 'ct-follow:span-end'),
            ],
            [
              'catch: head and root',
              authored.marker('ct:contact:catch'),
              tracks('ct-track:head-free', 'ct-track:root'),
            ],
          ];
      for (const [label, trunkFrame, pair] of pairs) {
        const path = authored.onPath(kind, trunkFrame);
        const frame = view.compositionOf(path);
        const prepared = minus(
          pair.prepared[0](frame),
          pair.prepared[1](frame),
        );
        const reference = minus(
          pair.authored[0](path, trunkFrame),
          pair.authored[1](path, trunkFrame),
        );

        expect(
          distance(prepared, reference) * cell.scale,
          label,
        ).toBeLessThanOrEqual(2);
      }
    });

    metric(
      'launches the head within 20 % of the sled speed and lodges it in the socket',
      () => {
        const { view, authored } = prepare(cell);
        const at = (trunkFrame: number) =>
          view.compositionOf(authored.onPath(kind, trunkFrame));
        const impact = authored.marker('ct:contact:impact');
        const separation = impact + 3;
        const speed = (name: string, from: number, to: number) =>
          Math.abs(view.track(name, at(to)).x - view.track(name, at(from)).x) /
          ((to - from) / FPS);
        const sled = speed('ct-track:root', impact - 6, impact);
        const head = speed('ct-track:head-free', separation, separation + 2);

        expect(Math.abs(head - sled) / sled).toBeLessThanOrEqual(0.2);
        const lodge = authored.marker('ct:contact:lodge') + 1;
        const lodgePath = authored.onPath(kind, lodge);
        const socket = minus(
          view.track('ct-track:head-free', at(lodge)),
          view.follow('ct-follow:far'),
        );
        const authoredSocket = minus(
          authored.track(kind, 'ct-track:head-free', lodgePath, lodge),
          authored.follow(kind, 'ct-follow:far'),
        );
        expect(
          distance(socket, authoredSocket) * cell.scale,
        ).toBeLessThanOrEqual(2);
      },
    );

    metric(
      'keeps a planted foot within 4 px per stance through the repeated cycles',
      () => {
        const { view, authored } = prepare(cell);
        const window = authored.window(hasCard(kind) ? '0' : '1');
        const from = view.compositionOf(authored.onPath(kind, window.from));
        const to = view.compositionOf(authored.onPath(kind, window.to));
        const floor = view.track('ct-track:foot-front', from).y;
        const runs: number[][] = [];
        let current: number[] = [];
        for (let frame = from; frame <= to; frame += 0.125) {
          const foot = view.track('ct-track:foot-front', frame);
          if (Math.abs(foot.y - floor) < 0.05) current.push(foot.x);
          else if (current.length) {
            runs.push(current);
            current = [];
          }
        }
        if (current.length) runs.push(current);

        expect(runs.length).toBeGreaterThan(0);
        const worst = Math.max(
          ...runs.map((xs) => (Math.max(...xs) - Math.min(...xs)) * cell.scale),
        );
        /* 4 px on short spans: the cycle count rounds (delta V3, issue owner 2026-11-22). */
        expect(worst).toBeLessThanOrEqual(4);
      },
    );

    metric(
      'returns the card copy onto its original between the slot and the restore',
      () => {
        if (!hasCard(kind)) return;
        const { preparation, view, authored } = prepare(cell);
        const end = (preparation.data as unknown as Data).op;
        const translate = (frames: Keyframe[], offset: number) => {
          let key = frames[0];
          for (const frame of frames)
            if ((frame.offset as number) <= offset) key = frame;
          const [, x = '0', y = '0'] =
            /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(
              String(key.transform),
            ) ?? [];
          const rotation =
            /rotate\(([-\d.]+)deg\)/.exec(String(key.transform))?.[1] ?? '0';
          return { x: Number(x), y: Number(y), rotation: Number(rotation) };
        };
        for (const trunkFrame of [
          authored.marker('ct:contact:slot') + 1,
          authored.marker('ct:restore') - 1,
        ]) {
          const offset =
            view.compositionOf(authored.onPath(kind, trunkFrame)) / end;
          const copy = translate(captured.frames, offset);
          const travel = translate(captured.travel, offset);

          expect(
            Math.hypot(copy.x + travel.x, copy.y + travel.y),
          ).toBeLessThanOrEqual(0.5);
          expect(Math.abs(copy.rotation)).toBeLessThanOrEqual(0.01);
        }
      },
    );
  });
});
