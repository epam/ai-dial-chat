import {
  ellipse,
  fixed,
  group,
  path,
  rect,
  type SnowmanShape,
} from './snowman-delivery-art';
import type { Point } from './snowman-delivery-rig';

/** Saturated colors stay readable on light and dark hosts; the contour matches the gift-wrapping elves. */
export const ELF_FIREWORKS_PALETTE = {
  ink: '#4f3d45',
  paper: '#fff6e6',
  sack: '#b5523d',
  sackShade: '#8f3b2f',
  rope: '#e7b45a',
  wood: '#b0743c',
  woodDark: '#80522a',
  plunger: '#d8333f',
  metal: '#7b8796',
  caneRed: '#d8333f',
  caneWhite: '#ffffff',
  flame: '#ffb627',
  flameCore: '#fff1b8',
  smoke: '#c9c3cf',
} as const;

/** Body colors of the rockets, in rack order. */
export const ROCKET_COLORS = [
  '#d8333f',
  '#2f6fd6',
  '#22a06b',
  '#e59a12',
  '#a64ac9',
  '#e0457f',
] as const;

/** Spark colors of the bursts, paired with rockets by index. */
export const BURST_COLORS = [
  ['#f2a922', '#e8475b'],
  ['#3f9be0', '#f2c14e'],
  ['#23b07d', '#ffd36b'],
  ['#f07c1d', '#3f7fe0'],
  ['#c74fc9', '#f2a922'],
  ['#e8475b', '#23b07d'],
] as const;

/** Rocket geometry in native units; the origin is the base between the fins. */
export const ROCKET = {
  /** Rotation pivot near the centre of mass. */
  pivot: [0, -22] as Point,
  /** Nozzle, where the flame and the fuse spark start. */
  nozzle: [0, -6] as Point,
  /** Nose tip. */
  tip: [0, -46] as Point,
  /** Where the elf's hand grips the dud. */
  grip: [0, -26] as Point,
} as const;

const { ink } = ELF_FIREWORKS_PALETTE;
const P = ELF_FIREWORKS_PALETTE;

/** A rocket standing on its fins, with one paper band. */
export const rocketArt = (color: string): SnowmanShape[] => [
  group(
    'fins',
    [
      path([
        [-6, -16],
        [-12, -1],
        [-6, -5],
      ]),
      path([
        [6, -16],
        [12, -1],
        [6, -5],
      ]),
    ],
    { fill: color, stroke: ink },
  ),
  group('body', [rect([0, -21], [12, 30], 3)], { fill: color, stroke: ink }),
  group('band', [rect([0, -24], [12, 6])], { fill: P.paper }),
  group(
    'nose',
    [
      path(
        [
          [-6, -35],
          [0, -46],
          [6, -35],
        ],
        true,
        0.08,
      ),
    ],
    { fill: P.paper, stroke: ink },
  ),
  group('nozzle', [rect([0, -5], [8, 4], 1)], { fill: P.metal, stroke: ink }),
];

/** A teardrop flame below the nozzle; flickers by scale. */
export const flameArt = (): SnowmanShape[] => [
  group(
    'flame-outer',
    [
      path(
        [
          [-5, -4],
          [0, 16],
          [5, -4],
        ],
        true,
        0.3,
      ),
    ],
    { fill: P.flame },
  ),
  group(
    'flame-core',
    [
      path(
        [
          [-2.5, -4],
          [0, 7],
          [2.5, -4],
        ],
        true,
        0.3,
      ),
    ],
    { fill: P.flameCore },
  ),
];

/** A small fuse spark at the nozzle. */
export const fuseSparkArt = (): SnowmanShape[] => [
  group('spark', [ellipse([0, 0], [6, 6])], { fill: P.flameCore }),
  group(
    'spark-rays',
    [
      path(
        [
          [-5, 0],
          [5, 0],
        ],
        false,
      ),
      path(
        [
          [0, -5],
          [0, 5],
        ],
        false,
      ),
    ],
    { stroke: P.flame, width: 1.6 },
  ),
];

/** A red sack of rockets standing on its base. */
export const sackArt = (): SnowmanShape[] => [
  group(
    'sack-noses',
    [
      path(
        [
          [-9, -32],
          [-5, -42],
          [-1, -32],
        ],
        true,
      ),
      path(
        [
          [2, -33],
          [7, -45],
          [12, -33],
        ],
        true,
      ),
    ],
    { fill: P.paper, stroke: ink },
  ),
  group(
    'sack-body',
    [
      path(
        [
          [-10, -32],
          [-19, -14],
          [-17, 0],
          [17, 0],
          [19, -14],
          [10, -32],
        ],
        true,
        0.18,
      ),
    ],
    { fill: P.sack, stroke: ink },
  ),
  group(
    'sack-shade',
    [
      path(
        [
          [8, -28],
          [15, -14],
          [13, -3],
          [5, -3],
          [10, -14],
        ],
        true,
        0.18,
      ),
    ],
    { fill: P.sackShade },
  ),
  group(
    'sack-tie',
    [
      path(
        [
          [-11, -31],
          [11, -31],
        ],
        false,
      ),
    ],
    { stroke: P.rope, width: 3 },
  ),
];

/** A candy cane hanging from the hand at the origin; its hook bottoms out at `length`. */
export const caneArt = (length: number): SnowmanShape[] => {
  const shaft: Point[] = [
    [0, -6],
    [0, length - 9],
    [2, length - 2],
    [8, length],
    [13, length - 3],
    [14, length - 9],
  ];
  const dashes = [
    { n: 'd', nm: 'dash', v: fixed(5) },
    { n: 'g', nm: 'gap', v: fixed(5) },
    { n: 'o', nm: 'offset', v: fixed(0) },
  ];
  return [
    group('cane-outline', [path(shaft, false, 0.12)], {
      stroke: ink,
      width: 6.2,
    }),
    group('cane-white', [path(shaft, false, 0.12)], {
      stroke: P.caneWhite,
      width: 4,
    }),
    {
      ty: 'gr',
      nm: 'cane-stripes',
      it: [
        path(shaft, false, 0.12),
        {
          ty: 'st',
          c: fixed([0.847, 0.2, 0.247, 1]),
          o: fixed(100),
          w: fixed(4),
          lc: 1,
          lj: 2,
          d: dashes,
        },
        {
          ty: 'tr',
          a: fixed([0, 0]),
          p: fixed([0, 0]),
          s: fixed([100, 100]),
          r: fixed(0),
          o: fixed(100),
        },
      ],
    },
  ];
};

/** The detonator's wooden box; its plunger is a separate group. */
export const detonatorBoxArt = (): SnowmanShape[] => [
  group('box', [rect([0, -12], [40, 24], 3)], {
    fill: P.wood,
    stroke: ink,
  }),
  group(
    'box-planks',
    [
      path(
        [
          [-18, -12],
          [18, -12],
        ],
        false,
      ),
    ],
    { stroke: P.woodDark, width: 1.4 },
  ),
];

/** The detonator's T-handle, its rod bottom at the box top. */
export const plungerArt = (): SnowmanShape[] => [
  group('rod', [rect([0, -30], [4, 12])], { fill: P.metal, stroke: ink }),
  group('handle', [rect([0, -36], [28, 6], 3)], {
    fill: P.plunger,
    stroke: ink,
  }),
];

/** One radial spark streak, pointing along +x. */
export const sparkArt = (color: string, width: number): SnowmanShape[] => [
  group(
    'streak',
    [
      path(
        [
          [-7, 0],
          [7, 0],
        ],
        false,
      ),
    ],
    { stroke: color, width },
  ),
];

/** A soft disc of unit radius behind a burst. */
export const flashArt = (color: string): SnowmanShape[] => [
  group('flash', [ellipse([0, 0], [2, 2])], { fill: color }),
];

/** A puff of launch smoke of unit radius. */
export const smokeArt = (): SnowmanShape[] => [
  group('smoke', [ellipse([0, 0], [2, 2])], { fill: P.smoke }),
];
