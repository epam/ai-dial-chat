import { type Point, SNOWMAN_RIG } from './snowman-delivery-rig';

/** Native Lottie property, fixed or authored in keyframes. */
export interface SnowmanProperty {
  /** Animation flag. */ a: number;
  /** Fixed value or keyframes. */ k: unknown;
}
/** Native Lottie vector shape or group. */
export interface SnowmanShape {
  /** Shape kind. */ ty: string;
  /** Authoring name. */ nm?: string;
  /** Nested shapes of a group. */ it?: SnowmanShape[];
  [key: string]: unknown;
}
/** Native transform of a layer or a vector group. */
export interface SnowmanTransform {
  /** Anchor. */ a: SnowmanProperty;
  /** Position. */ p: SnowmanProperty;
  /** Scale. */ s: SnowmanProperty;
  /** Rotation. */ r: SnowmanProperty;
  /** Opacity. */ o: SnowmanProperty;
}

/** A fixed native property. */
export const fixed = (k: unknown): SnowmanProperty => ({ a: 0, k });
/** An identity transform, optionally pivoting at `anchor`. */
export const identity = (anchor: Point = [0, 0]): SnowmanTransform => ({
  a: fixed(anchor),
  p: fixed(anchor),
  s: fixed([100, 100]),
  r: fixed(0),
  o: fixed(100),
});

/** Flat palette: blue shadows and a dark contour keep snow readable on white and dark hosts. */
export const SNOWMAN_PALETTE = {
  snow: '#ffffff',
  shadow: '#c6d5ec',
  deepShadow: '#7d9cc7',
  ink: '#22304a',
  coal: '#1d2230',
  carrot: '#ef7a1d',
  scarf: '#8e2436',
  scarfDark: '#6a1626',
  mitten: '#2d4f86',
  twig: '#6b4a2b',
  present: '#c8323c',
  ribbon: '#f2c14e',
  fir: '#2f7d4f',
  firDark: '#21603b',
  trunk: '#6b4a2b',
  bauble: '#f2c14e',
  wood: '#b0743c',
} as const;

const rgba = (hex: string) =>
  [1, 3, 5].map((n) => parseInt(hex.slice(n, n + 2), 16) / 255).concat(1);
const fill = (hex: string): SnowmanShape => ({
  ty: 'fl',
  c: fixed(rgba(hex)),
  o: fixed(100),
  r: 1,
});
const stroke = (hex: string, width: number): SnowmanShape => ({
  ty: 'st',
  c: fixed(rgba(hex)),
  o: fixed(100),
  w: fixed(width),
  lc: 2,
  lj: 2,
});

/** A vector group with an optional fill, contour and transform. */
export const group = (
  nm: string,
  shapes: SnowmanShape[],
  paint: { fill?: string; stroke?: string; width?: number } = {},
  transform = identity(),
): SnowmanShape => ({
  ty: 'gr',
  nm,
  it: [
    ...shapes,
    ...(paint.stroke ? [stroke(paint.stroke, paint.width ?? 1.4)] : []),
    ...(paint.fill ? [fill(paint.fill)] : []),
    { ty: 'tr', ...transform },
  ],
});

const ellipse = ([x, y]: Point, [w, h]: Point): SnowmanShape => ({
  ty: 'el',
  p: fixed([x, y]),
  s: fixed([w, h]),
  d: 1,
});
const rect = ([x, y]: Point, [w, h]: Point, r = 0): SnowmanShape => ({
  ty: 'rc',
  p: fixed([x, y]),
  s: fixed([w, h]),
  r: fixed(r),
  d: 1,
});
/** A closed or open polyline with optional symmetric smoothing. */
const path = (points: Point[], closed = true, smooth = 0): SnowmanShape => {
  const tangent = (i: number): Point => {
    if (!smooth) return [0, 0];
    const prev = points[(i + points.length - 1) % points.length];
    const next = points[(i + 1) % points.length];
    return [(next[0] - prev[0]) * smooth, (next[1] - prev[1]) * smooth];
  };
  return {
    ty: 'sh',
    ks: fixed({
      v: points,
      i: points.map((_, i) => {
        const [x, y] = tangent(i);
        return [-x, -y];
      }),
      o: points.map((_, i) => tangent(i)),
      c: closed,
    }),
  };
};

const { snow, shadow, ink } = SNOWMAN_PALETTE;
const P = SNOWMAN_PALETTE;

/** Two snow balls with buttons; drawn in the rig frame, pivoting at the ground point. */
export const bodyArt = (): SnowmanShape[] => {
  const { bottomBall, middleBall } = SNOWMAN_RIG;
  const ball = (name: string, [x, y]: Point, r: number) =>
    group(name, [
      group(
        `${name}-shade`,
        [ellipse([x - r * 0.18, y + r * 0.2], [r * 1.5, r * 1.4])],
        {
          fill: shadow,
        },
      ),
      group(
        `${name}-snow`,
        [ellipse([x + r * 0.12, y - r * 0.1], [r * 1.6, r * 1.55])],
        {
          fill: snow,
        },
      ),
      group(`${name}-outline`, [ellipse([x, y], [r * 2, r * 2])], {
        stroke: ink,
        fill: '#eef3fb',
      }),
    ]);
  return [
    group(
      'buttons',
      [ellipse([7, -82], [3.4, 3.4]), ellipse([9, -72], [3.4, 3.4])],
      { fill: P.coal },
    ),
    ball('middle-ball', middleBall.center, middleBall.radius),
    ball('bottom-ball', bottomBall.center, bottomBall.radius),
  ];
};

/** A stubby snow foot centred on its ground contact. */
export const footArt = (): SnowmanShape[] => {
  const [rx, ry] = SNOWMAN_RIG.footRadius;
  return [
    group('foot', [ellipse([0, -ry], [rx * 2, ry * 2])], {
      stroke: ink,
      fill: '#e8eef8',
    }),
  ];
};

/** Scarf knot the tail pivots at, in the rig frame. */
export const SCARF_KNOT: Point = [-4, -88];

/** Burgundy scarf wrap with a separately rotating tail pivoting at the knot. */
export const scarfArt = (): SnowmanShape[] => {
  const [kx, ky] = SCARF_KNOT;
  return [
    group(
      'scarf-tail',
      [
        path(
          [
            [kx, ky],
            [kx + 3, ky],
            [kx + 5, ky + 22],
            [kx - 1, ky + 24],
          ],
          true,
          0.08,
        ),
      ],
      { stroke: P.scarfDark, fill: P.scarf, width: 1 },
      identity(SCARF_KNOT),
    ),
    group('scarf-wrap', [rect([0, -89], [40, 9], 4.5)], {
      stroke: P.scarfDark,
      fill: P.scarf,
      width: 1,
    }),
  ];
};

/** Expression groups on the head; exactly one is visible at a time. */
export enum SnowmanFace {
  Neutral = 'neutral',
  Idea = 'idea',
  Cautious = 'cautious',
  Smug = 'smug',
  Indignant = 'indignant',
  Sneeze = 'sneeze',
}

const brows: Record<SnowmanFace, [Point, Point][]> = {
  [SnowmanFace.Neutral]: [
    [
      [1, -9],
      [6, -10],
    ],
    [
      [8, -10],
      [13, -9],
    ],
  ],
  [SnowmanFace.Idea]: [
    [
      [1, -12],
      [6, -14],
    ],
    [
      [8, -14],
      [13, -12],
    ],
  ],
  [SnowmanFace.Cautious]: [
    [
      [1, -10],
      [6, -12],
    ],
    [
      [8, -12],
      [13, -10],
    ],
  ],
  [SnowmanFace.Smug]: [
    [
      [1, -8],
      [6, -8],
    ],
    [
      [8, -11],
      [13, -13],
    ],
  ],
  [SnowmanFace.Indignant]: [
    [
      [1, -11],
      [6, -8],
    ],
    [
      [8, -8],
      [13, -11],
    ],
  ],
  [SnowmanFace.Sneeze]: [
    [
      [1, -7],
      [6, -9],
    ],
    [
      [8, -9],
      [13, -7],
    ],
  ],
};

/** Head drawn around its centre, facing +x: snow ball, eyes, carrot and the expression groups. */
export const headArt = (): SnowmanShape[] => {
  const r = SNOWMAN_RIG.headRadius;
  const { carrotBase, carrotTip } = SNOWMAN_RIG;
  const eyes = (squint: boolean) =>
    squint
      ? [
          path(
            [
              [2, -5],
              [6, -4],
            ],
            false,
          ),
          path(
            [
              [8, -4],
              [12, -5],
            ],
            false,
          ),
        ]
      : [ellipse([4, -4], [3.2, 3.6]), ellipse([10, -4], [3.2, 3.6])];
  const face = (name: SnowmanFace): SnowmanShape =>
    group(`face-${name}`, [
      group(
        `brows-${name}`,
        brows[name].map((line) => path(line, false)),
        { stroke: P.coal, width: 1.6 },
      ),
      name === SnowmanFace.Smug || name === SnowmanFace.Sneeze
        ? group(`eyes-${name}`, eyes(true), { stroke: P.coal, width: 1.6 })
        : group(`eyes-${name}`, eyes(false), { fill: P.coal }),
      name === SnowmanFace.Sneeze
        ? group(`mouth-${name}`, [ellipse([7, 7], [5, 4])], { fill: P.coal })
        : group(
            `mouth-${name}`,
            [
              path(
                name === SnowmanFace.Indignant
                  ? [
                      [3, 8],
                      [8, 6],
                      [12, 8],
                    ]
                  : [
                      [3, 6],
                      [8, 9],
                      [12, 6],
                    ],
                false,
              ),
            ],
            { stroke: P.coal, width: 1.4 },
          ),
    ]);
  return [
    group(
      'carrot',
      [
        path([
          [carrotBase[0], carrotBase[1] - 3],
          carrotTip,
          [carrotBase[0], carrotBase[1] + 3],
        ]),
      ],
      { stroke: '#a24d0e', fill: P.carrot, width: 1 },
    ),
    ...Object.values(SnowmanFace).map(face),
    group('head-shade', [ellipse([-3, 3], [r * 1.5, r * 1.4])], {
      fill: shadow,
    }),
    group('head-snow', [ellipse([1, -1], [r * 1.6, r * 1.55])], { fill: snow }),
    group('head-outline', [ellipse([0, 0], [r * 2, r * 2])], {
      stroke: ink,
      fill: '#eef3fb',
    }),
  ];
};

/** A two-segment stick arm drawn from `shoulder` along +x; the forearm group bends at the elbow. */
export const armArt = (shoulder: Point): SnowmanShape[] => {
  const { upperArm, lowerArm, gripReach } = SNOWMAN_RIG;
  const elbow: Point = [shoulder[0] + upperArm, shoulder[1]];
  const wrist: Point = [elbow[0] + lowerArm, elbow[1]];
  return [
    group(
      'upper-arm',
      [
        group(
          'forearm',
          [
            group(
              'mitten',
              [
                ellipse([wrist[0] + gripReach - 1, wrist[1]], [11, 10]),
                ellipse([wrist[0] + 2, wrist[1] - 5], [5, 5]),
              ],
              { stroke: ink, fill: P.mitten, width: 1 },
            ),
            group('forearm-stick', [path([elbow, wrist], false)], {
              stroke: P.twig,
              width: 2.6,
            }),
          ],
          {},
          identity(elbow),
        ),
        group(
          'upper-stick',
          [
            path([shoulder, elbow], false),
            path(
              [
                [shoulder[0] + upperArm * 0.55, shoulder[1]],
                [shoulder[0] + upperArm * 0.7, shoulder[1] - 6],
              ],
              false,
            ),
          ],
          { stroke: P.twig, width: 2.8 },
        ),
      ],
      {},
      identity(shoulder),
    ),
  ];
};

/** A wrapped present, 22 × 18 units, standing on its bottom centre. */
export const presentArt = (): SnowmanShape[] => [
  group(
    'bow',
    [
      path(
        [
          [0, -18],
          [-7, -24],
          [-5, -17],
        ],
        true,
        0.1,
      ),
      path(
        [
          [0, -18],
          [7, -24],
          [5, -17],
        ],
        true,
        0.1,
      ),
    ],
    { stroke: '#9a6d14', fill: P.ribbon, width: 0.8 },
  ),
  group('ribbon', [rect([0, -9], [4, 18]), rect([0, -9], [22, 4])], {
    fill: P.ribbon,
  }),
  group('box', [rect([0, -9], [22, 18], 1.5)], {
    stroke: '#7c1a22',
    fill: P.present,
    width: 1.2,
  }),
];

/** Present size, for grip and ground contact. */
export const PRESENT_SIZE: Point = [22, 18];

/** A small fir: trunk and three tiers, drawn from its ground centre. */
export const treeArt = (): SnowmanShape[] => [
  group(
    'baubles',
    [
      ellipse([-8, -40], [5, 5]),
      ellipse([9, -58], [5, 5]),
      ellipse([-4, -76], [4.4, 4.4]),
    ],
    { fill: P.bauble },
  ),
  ...[
    [-92, 22, 30],
    [-70, 32, 30],
    [-46, 42, 30],
  ].map(([top, half, height], index) =>
    group(
      `tier-${index}`,
      [
        path(
          [
            [0, top],
            [half, top + height],
            [-half, top + height],
          ],
          true,
          0.03,
        ),
      ],
      { stroke: P.firDark, fill: P.fir, width: 1.2 },
    ),
  ),
  group('trunk', [rect([0, -8], [9, 16], 1)], {
    stroke: '#4a321c',
    fill: P.trunk,
    width: 1,
  }),
];

/** Height of the fir in native units. */
export const TREE_HEIGHT = 92;

/** The middle bough on the snowman's side, pivoting at the trunk; the head lodges near its tip. */
export const branchArt = (): SnowmanShape[] => [
  group(
    'bough',
    [
      path(
        [
          [-6, -63],
          [-36, -66],
          [-40, -59],
          [-30, -55],
          [-6, -57],
        ],
        true,
        0.12,
      ),
    ],
    { stroke: P.firDark, fill: P.fir, width: 1.2 },
  ),
];

/** Bough pivot on the trunk and the socket the head lodges in, relative to the tree's ground centre. */
export const BRANCH_PIVOT: Point = [-6, -60];
export const BRANCH_SOCKET: Point = [-26, -62];

/** Needles drawn over the lodged head so it reads as inside the bough. */
export const needlesArt = (): SnowmanShape[] => [
  group(
    'needles',
    [
      path(
        [
          [-38, -60],
          [-28, -66],
          [-17, -60],
          [-27, -56],
        ],
        true,
        0.1,
      ),
    ],
    { stroke: P.firDark, fill: P.fir, width: 1 },
  ),
];

/** A snowbank mound, 30 × 14 units, on its ground centre. */
export const snowbankArt = (): SnowmanShape[] => [
  group(
    'snowbank',
    [
      path(
        [
          [-16, 0],
          [-9, -11],
          [3, -14],
          [13, -8],
          [17, 0],
        ],
        true,
        0.14,
      ),
    ],
    { stroke: ink, fill: '#eef3fb', width: 1.2 },
  ),
];

/** The ground strip: a snow ledge, platform or rim cap below the floor line. */
export const groundArt = (
  length: number,
  thickness: number,
): SnowmanShape[] => [
  group(
    'ground-shade',
    [rect([0, thickness * 0.7], [length, thickness * 0.6], 3)],
    {
      fill: shadow,
    },
  ),
  group(
    'ground',
    [rect([0, thickness / 2], [length, thickness], thickness / 2)],
    {
      stroke: ink,
      fill: '#f4f7fc',
      width: 1,
    },
  ),
];

/** A drawn wooden sled, centred on its bottom edge. */
export const sledArt = (): SnowmanShape[] => {
  const [w, h] = SNOWMAN_RIG.sledSize;
  return [
    group(
      'runner',
      [
        path(
          [
            [-w / 2, -2],
            [w / 2 - 6, -2],
            [w / 2, -8],
          ],
          false,
          0.1,
        ),
      ],
      { stroke: P.twig, width: 2.4 },
    ),
    group('deck', [rect([0, -h / 2 - 2], [w - 8, h - 6], 2)], {
      stroke: '#6e4422',
      fill: P.wood,
      width: 1.2,
    }),
  ];
};

/** One snow puff particle centred on its origin. */
export const puffArt = (radius: number): SnowmanShape[] => [
  group('puff', [ellipse([0, 0], [radius * 2, radius * 2])], {
    stroke: SNOWMAN_PALETTE.deepShadow,
    fill: snow,
    width: 0.8,
  }),
];
