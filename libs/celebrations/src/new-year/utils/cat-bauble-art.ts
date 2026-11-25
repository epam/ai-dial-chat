import {
  ellipse,
  group,
  identity,
  path,
  rect,
  type SnowmanShape,
} from './snowman-delivery-art';
import type { Point } from './snowman-delivery-rig';

/** Flat palette: a cool grey tabby with a dark contour reads on light and dark hosts. */
export const CAT_BAUBLE_PALETTE = {
  ink: '#2f3340',
  fur: '#9aa0aa',
  furShade: '#7d838e',
  stripe: '#5d626c',
  farFur: '#7a808b',
  white: '#f7f4ef',
  eye: '#e9a227',
  pupil: '#1d1f26',
  pink: '#e8949c',
  collar: '#c8323c',
  bell: '#f2c14e',
  fir: '#2f7d4f',
  firDark: '#21603b',
  trunk: '#6b4a2b',
  star: '#f2c14e',
  hook: '#c9b27a',
  tangerine: '#f28a1d',
  tangerineShade: '#d9701a',
  leaf: '#3f8f4a',
} as const;

/** Bauble colors, from the lowest one up. */
export const BAUBLE_COLORS = ['#d8333f', '#2f6fd6', '#f2c14e'] as const;

/** Cat rig in native units; the cat faces +x and its origin is the ground between its feet. */
export const CAT_RIG = {
  /** Near foreleg pivot. */
  shoulder: [16, -20] as Point,
  /** Far foreleg pivot. */
  farShoulder: [11, -20] as Point,
  /** Near hind leg pivot. */
  hip: [-18, -20] as Point,
  /** Far hind leg pivot. */
  farHip: [-23, -20] as Point,
  /** Leg length from pivot to paw tip at rest. */
  leg: 20,
  /** Longest foreleg stretch, as a multiple of `leg`. */
  maxStretch: 3.4,
  /** Head pivot at the neck. */
  neck: [22, -30] as Point,
  /** Where the teeth hold a carried toy. */
  mouth: [41, -35] as Point,
  /** Tail pivot. */
  tail: [-27, -30] as Point,
  /** Bell pivot on the collar. */
  bell: [25, -31] as Point,
  /** Ear pivot at the top of the head. */
  ears: [31, -51] as Point,
} as const;

/**
 * Fir geometry in fir units; the origin is the trunk's ground centre and −x
 * faces the cat. One fir unit is `CAT_FIR.scale` cat units.
 */
export const CAT_FIR = {
  /** Cat units per fir unit. */
  scale: 1.35,
  /** Height of the star tip. */
  height: 112,
  /** The empty hook at the middle tier's tip on the cat's side; its height matches the rearing cat's mouth. */
  hook: [-27, -51.5] as Point,
  /** Half width of the trunk, for the slide's contact. */
  trunkHalf: 4.5,
  /** Bauble pivots (thread tops), thread lengths and radii, lowest on the cat's side first. */
  baubles: [
    { pivot: [-36, -23] as Point, thread: 5, radius: 4.5 },
    { pivot: [36, -23] as Point, thread: 5, radius: 4.2 },
    { pivot: [-17, -77] as Point, thread: 5, radius: 3.8 },
  ],
} as const;

/** A fir point in cat units. */
export const firToCat = ([x, y]: Point): Point => [
  x * CAT_FIR.scale,
  y * CAT_FIR.scale,
];

/** Radius of the drawn tangerine, in native units. */
export const TANGERINE_RADIUS = 9;

const P = CAT_BAUBLE_PALETTE;
const { ink } = P;

const leg = (
  name: string,
  [x, y]: Point,
  fur: string,
  hasWhitePaw: boolean,
): SnowmanShape =>
  group(
    name,
    [
      ...(hasWhitePaw
        ? [group('paw', [ellipse([x, -1.5], [9, 5])], { fill: P.white })]
        : []),
      group('shin', [rect([x, y + 10], [7.5, 21], 3.6)], {
        fill: fur,
        stroke: ink,
        width: 1.2,
      }),
    ],
    {},
    identity([x, y]),
  );

/** The near foreleg, drawn outside the body squash: a stretchable shin and a paw that follows its tip. */
export const reachingLegArt = (): SnowmanShape => {
  const [x, y] = CAT_RIG.shoulder;
  return group(
    'fore-near',
    [
      group(
        'paw',
        [ellipse([0, -1.5], [9.5, 5.5])],
        { fill: P.white, stroke: ink, width: 1 },
        { ...identity(), p: { a: 0, k: [x, y + CAT_RIG.leg] } },
      ),
      group(
        'shin',
        [rect([x, y + 10], [7.5, 21], 3.6)],
        { fill: P.fur, stroke: ink, width: 1.2 },
        identity([x, y]),
      ),
    ],
    {},
    identity([x, y]),
  );
};

const EYES: Point[] = [
  [29, -44],
  [37, -44.5],
];

/** The head, with named groups for the ears, eyes and pupils. */
const headArt = (): SnowmanShape =>
  group(
    'head',
    [
      group(
        'whiskers',
        [
          path(
            [
              [42, -37],
              [52, -39],
            ],
            false,
          ),
          path(
            [
              [42, -35],
              [52, -34],
            ],
            false,
          ),
        ],
        { stroke: P.white, width: 0.7 },
      ),
      group(
        'nose',
        [
          path(
            [
              [41, -40.5],
              [44.5, -40.5],
              [42.8, -38.2],
            ],
            true,
            0.1,
          ),
        ],
        { fill: P.pink, stroke: ink, width: 0.6 },
      ),
      group('muzzle', [ellipse([39.5, -36.5], [11, 7.5])], { fill: P.white }),
      group(
        'eyes',
        [
          ...EYES.map(([x, y], index) =>
            group(
              `pupil-${index}`,
              [ellipse([x + 0.6, y], [2.4, 5])],
              { fill: P.pupil },
              identity([x + 0.6, y]),
            ),
          ),
          group(
            'irises',
            EYES.map((at) => ellipse(at, [6, 7])),
            { fill: P.eye, stroke: ink, width: 0.8 },
          ),
        ],
        {},
        identity([33, -44]),
      ),
      group(
        'forehead-stripes',
        [
          path(
            [
              [28, -53],
              [30, -48.5],
              [32, -53],
            ],
            true,
            0.1,
          ),
          path(
            [
              [33.5, -53.5],
              [35, -49.5],
              [37, -53],
            ],
            true,
            0.1,
          ),
        ],
        { fill: P.stripe },
      ),
      group('skull', [ellipse([32, -43], [27, 23])], {
        fill: P.fur,
        stroke: ink,
        width: 1.3,
      }),
      group(
        'ears',
        [
          group(
            'inner-ears',
            [
              path(
                [
                  [24.5, -51],
                  [25.5, -59],
                  [29.5, -53],
                ],
                true,
                0.05,
              ),
              path(
                [
                  [35, -53.5],
                  [39.5, -59.5],
                  [39.5, -51],
                ],
                true,
                0.05,
              ),
            ],
            { fill: P.pink },
          ),
          group(
            'outer-ears',
            [
              path(
                [
                  [21.5, -49],
                  [24, -63],
                  [31.5, -53],
                ],
                true,
                0.06,
              ),
              path(
                [
                  [33, -54],
                  [41.5, -62.5],
                  [42, -48],
                ],
                true,
                0.06,
              ),
            ],
            { fill: P.fur, stroke: ink, width: 1.2 },
          ),
        ],
        {},
        identity(CAT_RIG.ears),
      ),
    ],
    {},
    identity(CAT_RIG.neck),
  );

/** The grey tabby without its near foreleg, drawn front to back; joints are named groups. */
export const catArt = (): SnowmanShape =>
  group('cat', [
    leg('hind-near', CAT_RIG.hip, P.fur, true),
    headArt(),
    group(
      'bell',
      [
        group('bell-ball', [ellipse([25, -27.5], [6, 6])], {
          fill: P.bell,
          stroke: ink,
          width: 0.8,
        }),
      ],
      {},
      identity(CAT_RIG.bell),
    ),
    group(
      'collar',
      [
        path(
          [
            [17, -36],
            [27, -31],
            [26.5, -28.5],
            [16, -33],
          ],
          true,
          0.1,
        ),
      ],
      { fill: P.collar },
    ),
    group('chest', [ellipse([22, -24], [14, 17])], { fill: P.white }),
    group(
      'stripes',
      [
        path(
          [
            [-16, -41],
            [-12, -32],
            [-9, -41],
          ],
          true,
          0.12,
        ),
        path(
          [
            [-4, -41.5],
            [-1, -33],
            [3, -41.5],
          ],
          true,
          0.12,
        ),
        path(
          [
            [8, -40.5],
            [10, -34],
            [13, -40],
          ],
          true,
          0.12,
        ),
      ],
      { fill: P.stripe },
    ),
    group(
      'belly-shade',
      [
        path(
          [
            [-26, -24],
            [-10, -16.5],
            [12, -16.5],
            [24, -21],
            [10, -19.5],
            [-12, -19.5],
          ],
          true,
          0.12,
        ),
      ],
      { fill: P.furShade },
    ),
    group('body', [ellipse([0, -28], [60, 27])], {
      fill: P.fur,
      stroke: ink,
      width: 1.3,
    }),
    group(
      'tail',
      [
        group(
          'tail-tip',
          [
            path(
              [
                [-37, -59],
                [-34, -66],
              ],
              false,
            ),
          ],
          { stroke: P.stripe, width: 6.2 },
        ),
        group(
          'tail-fur',
          [
            path(
              [
                [-27, -30],
                [-37, -37],
                [-40, -51],
                [-34, -66],
              ],
              false,
              0.22,
            ),
          ],
          { stroke: P.fur, width: 6.2 },
        ),
        group(
          'tail-line',
          [
            path(
              [
                [-27, -30],
                [-37, -37],
                [-40, -51],
                [-34, -66],
              ],
              false,
              0.22,
            ),
          ],
          { stroke: ink, width: 8.6 },
        ),
      ],
      {},
      identity(CAT_RIG.tail),
    ),
    leg('fore-far', CAT_RIG.farShoulder, P.farFur, false),
    leg('hind-far', CAT_RIG.farHip, P.farFur, false),
  ]);

/** A small fir with three baubles, a star and an empty hook on the cat's side. */
export const firArt = (hook: Point = CAT_FIR.hook): SnowmanShape[] => [
  ...CAT_FIR.baubles.map(({ pivot, thread, radius }, index) =>
    group(
      `bauble-${index}`,
      [
        group(
          'ball-glint',
          [
            ellipse(
              [pivot[0] - radius * 0.3, pivot[1] + thread - radius * 0.3],
              [radius * 0.6, radius * 0.6],
            ),
          ],
          { fill: P.white },
        ),
        group(
          'ball',
          [ellipse([pivot[0], pivot[1] + thread], [radius * 2, radius * 2])],
          {
            fill: BAUBLE_COLORS[index],
            stroke: ink,
            width: 0.9,
          },
        ),
        group(
          'thread',
          [path([pivot, [pivot[0], pivot[1] + thread - radius]], false)],
          { stroke: P.hook, width: 0.9 },
        ),
      ],
      {},
      identity(pivot),
    ),
  ),
  group(
    'hook',
    [
      path(
        [
          [hook[0] + 2, hook[1] - 5],
          [hook[0] - 1.5, hook[1] - 3],
          [hook[0], hook[1]],
        ],
        false,
        0.2,
      ),
    ],
    { stroke: P.hook, width: 1.4 },
  ),
  group(
    'star',
    [
      path(
        Array.from({ length: 10 }, (_, i): Point => {
          const angle = (i * Math.PI) / 5 - Math.PI / 2;
          const r = i % 2 ? 3.2 : 7.5;
          return [
            Math.cos(angle) * r,
            -CAT_FIR.height + 7.5 + Math.sin(angle) * r,
          ];
        }),
      ),
    ],
    { fill: P.star, stroke: ink, width: 0.8 },
  ),
  ...[
    [-104, 18, 32],
    [-80, 27, 34],
    [-54, 37, 36],
  ].map(([top, half, height], index) =>
    group(
      `tier-${index}`,
      [
        path(
          [
            [1, top],
            [half * 0.44, top + height * 0.5],
            [half, top + height * 0.9],
            [half * 0.6, top + height],
            [half * 0.1, top + height * 0.93],
            [-half * 0.44, top + height * 1.01],
            [-half, top + height * 0.87],
            [-half * 0.44, top + height * 0.47],
          ],
          true,
          0.1,
        ),
      ],
      { stroke: P.firDark, fill: P.fir, width: 1 },
    ),
  ),
  group('trunk', [rect([0, -9], [9, 18], 1)], {
    stroke: '#4a321c',
    fill: P.trunk,
    width: 1,
  }),
];

/** A tangerine with a stem loop at its top, drawn from its centre. */
export const tangerineArt = (): SnowmanShape[] => [
  group(
    'leaf',
    [
      path(
        [
          [1, -TANGERINE_RADIUS - 1],
          [7, -TANGERINE_RADIUS - 5],
          [4, -TANGERINE_RADIUS + 1],
        ],
        true,
        0.2,
      ),
    ],
    { fill: P.leaf, stroke: ink, width: 0.7 },
  ),
  group(
    'peel-shade',
    [
      path(
        [
          [TANGERINE_RADIUS * 0.85, -TANGERINE_RADIUS * 0.3],
          [TANGERINE_RADIUS * 0.4, TANGERINE_RADIUS * 0.85],
          [-TANGERINE_RADIUS * 0.6, TANGERINE_RADIUS * 0.7],
          [TANGERINE_RADIUS * 0.3, TANGERINE_RADIUS * 0.4],
        ],
        true,
        0.2,
      ),
    ],
    { fill: P.tangerineShade },
  ),
  group(
    'peel',
    [ellipse([0, 0], [TANGERINE_RADIUS * 2, TANGERINE_RADIUS * 1.85])],
    {
      fill: P.tangerine,
      stroke: ink,
      width: 1,
    },
  ),
];
