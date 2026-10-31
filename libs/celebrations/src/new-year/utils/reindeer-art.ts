/** Native vector artwork; material colors are intrinsic to the seasonal characters. */
export const REINDEER_PALETTE = {
  ink: '#342535',
  fur: '#8e5639',
  light: '#bc8150',
  shade: '#58382d',
  cream: '#f7e7c8',
  antler: '#dbba83',
  hoof: '#302b36',
  nose: '#b52c42',
  gold: '#efc568',
  red: '#a72b46',
  redLight: '#d74959',
  snow: '#e8f3ff',
  ice: '#a9c4dd',
  white: '#fff9ec',
  green: '#337b69',
} as const;

export type ReindeerPoint = [number, number];
export interface ReindeerProperty {
  a: number;
  k: unknown;
}
export interface ReindeerShape {
  ty: string;
  nm?: string;
  it?: ReindeerShape[];
  [key: string]: unknown;
}
export interface ReindeerTransform {
  a: ReindeerProperty;
  p: ReindeerProperty;
  s: ReindeerProperty;
  r: ReindeerProperty;
  o: ReindeerProperty;
}
export const fixed = (k: unknown): ReindeerProperty => ({ a: 0, k });
export const identity = (
  anchor: ReindeerPoint = [0, 0],
): ReindeerTransform => ({
  a: fixed(anchor),
  p: fixed(anchor),
  s: fixed([100, 100]),
  r: fixed(0),
  o: fixed(100),
});
const color = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).concat(1);

export const group = (
  nm: string,
  shapes: ReindeerShape[],
  fill?: string,
  stroke?: string,
  width = 1.2,
  transform = identity(),
): ReindeerShape => ({
  ty: 'gr',
  nm,
  it: [
    ...shapes,
    ...(stroke
      ? [
          {
            ty: 'st',
            c: fixed(color(stroke)),
            o: fixed(100),
            w: fixed(width),
            lc: 2,
            lj: 2,
          },
        ]
      : []),
    ...(fill ? [{ ty: 'fl', c: fixed(color(fill)), o: fixed(100), r: 1 }] : []),
    { ty: 'tr', ...transform },
  ],
});
export const ellipse = (p: ReindeerPoint, s: ReindeerPoint): ReindeerShape => ({
  ty: 'el',
  p: fixed(p),
  s: fixed(s),
  d: 1,
});
export const path = (
  v: ReindeerPoint[],
  closed = true,
  smooth = 0,
): ReindeerShape => {
  const tangents = v.map((_, i): ReindeerPoint => {
    if (!smooth || (!closed && (i === 0 || i === v.length - 1))) return [0, 0];
    const prev = v[(i + v.length - 1) % v.length];
    const next = v[(i + 1) % v.length];
    return [(next[0] - prev[0]) * smooth, (next[1] - prev[1]) * smooth];
  });
  return {
    ty: 'sh',
    ks: fixed({
      v,
      i: tangents.map(([x, y]) => [-x, -y]),
      o: tangents,
      c: closed,
    }),
  };
};
export const positioned = (p: ReindeerPoint, scale = 1): ReindeerTransform => ({
  ...identity(),
  p: fixed(p),
  s: fixed([scale * 100, scale * 100]),
});
const P = REINDEER_PALETTE;

/** Shared landmarks for the drawing, neck articulation and nose contact. */
export const REINDEER_NECK: ReindeerPoint = [24, -65];
export const headOrigin = (isCalf: boolean): ReindeerPoint =>
  isCalf ? [34, -96] : [38, -102];
export const headScale = (isCalf: boolean) => (isCalf ? 1.12 : 1);

/** Broad upper limbs overlap the torso; slender shins end in a flat sole. */
export const legArt = (
  isFar: boolean,
  knee: ReindeerProperty,
  hoof = fixed(0),
  isHind = false,
): ReindeerShape[] => [
  group(
    'shin',
    [
      group(
        'hoof',
        [
          path(
            [
              [-4, 49],
              [3, 48],
              [7, 53],
              [7, 56],
              [-4, 56],
            ],
            true,
            0.06,
          ),
        ],
        P.hoof,
        undefined,
        1,
        { ...identity([0, 56]), r: hoof },
      ),
      group(
        'shin-fur',
        [
          path(
            [
              [-3, 25],
              [3, 26],
              [2, 49],
              [-3, 50],
            ],
            true,
            0.08,
          ),
        ],
        isFar ? P.shade : P.light,
      ),
    ],
    undefined,
    undefined,
    1,
    { ...identity([0, 28]), r: knee },
  ),
  group(
    'thigh',
    [
      path(
        isHind
          ? [
              [-9, -8],
              [7, -7],
              [9, 6],
              [3, 28],
              [-3, 30],
              [-6, 14],
            ]
          : [
              [-6, -8],
              [7, -8],
              [6, 8],
              [3, 29],
              [-3, 30],
              [-4, 11],
            ],
        true,
        0.15,
      ),
    ],
    isFar ? P.shade : P.fur,
  ),
];

/** The calf has a compact rump; the adult carries a fuller chest and shoulder. */
export const bodyArt = (isCalf: boolean): ReindeerShape[] => [
  group('harness-bell', [ellipse([24, -49], [6, 7])], P.gold, P.shade, 0.7),
  group(
    'harness',
    [
      path(
        [
          [17, -82],
          [25, -64],
          [20, -46],
        ],
        false,
        0.12,
      ),
    ],
    undefined,
    P.red,
    4,
  ),
  group(
    'chest-bib',
    [
      path(
        [
          [20, -85],
          [35, -82],
          [37, -64],
          [24, -47],
          [12, -52],
        ],
        true,
        0.16,
      ),
    ],
    P.cream,
  ),
  group(
    'back-light',
    [
      path(
        [
          [-42, -74],
          [-26, -84],
          [-3, -83],
          [18, -77],
          [3, -73],
          [-23, -77],
        ],
        true,
        0.15,
      ),
    ],
    P.light,
  ),
  group(
    'body',
    [
      path(
        isCalf
          ? [
              [-47, -63],
              [-42, -79],
              [-28, -86],
              [-5, -80],
              [18, -85],
              [34, -74],
              [29, -52],
              [9, -44],
              [-18, -48],
              [-38, -45],
            ]
          : [
              [-51, -62],
              [-47, -77],
              [-28, -86],
              [-5, -81],
              [19, -90],
              [35, -76],
              [30, -54],
              [12, -43],
              [-16, -48],
              [-39, -43],
            ],
        true,
        0.14,
      ),
    ],
    P.fur,
    P.shade,
    1.2,
  ),
];

/** A curved chest-to-jaw contour, with the bib carried by the same neck pivot. */
export const neckArt = (isCalf = false): ReindeerShape[] => [
  group(
    'neck-bib',
    [
      path(
        [
          [38, -100],
          [48, -96],
          [43, -78],
          [37, -62],
          [26, -53],
          [29, -75],
        ],
        true,
        0.14,
      ),
    ],
    P.cream,
  ),
  group(
    'neck-light',
    [
      path(
        [
          [20, -77],
          [25, -96],
          [36, -107],
          [40, -100],
          [32, -82],
          [29, -65],
        ],
        true,
        0.15,
      ),
    ],
    P.light,
  ),
  group(
    'neck',
    [
      path(
        [
          [11, -68],
          [21, -88],
          [29, isCalf ? -104 : -111],
          [43, isCalf ? -107 : -113],
          [48, -97],
          [45, -78],
          [33, -51],
          [19, -53],
        ],
        true,
        0.15,
      ),
    ],
    P.fur,
    P.shade,
    1.1,
  ),
];

/** The muzzle contact remains [33,5] in head space, including calf head scaling. */
export const headArt = (
  isCalf: boolean,
  eye: ReindeerProperty,
  brow: ReindeerProperty,
  gaze = fixed([0, 0]),
  ear = fixed(0),
): ReindeerShape[] => {
  const antlers: ReindeerPoint[][] = isCalf
    ? [
        [
          [-10, -19],
          [-14, -31],
          [-12, -40],
        ],
        [
          [-14, -30],
          [-22, -34],
        ],
        [
          [3, -20],
          [6, -34],
          [13, -40],
        ],
      ]
    : [
        [
          [-11, -19],
          [-16, -32],
          [-15, -43],
          [-20, -53],
        ],
        [
          [-16, -33],
          [-28, -38],
          [-31, -45],
        ],
        [
          [-15, -43],
          [-6, -48],
          [-4, -56],
        ],
        [
          [4, -21],
          [7, -35],
          [17, -46],
          [17, -55],
        ],
        [
          [7, -35],
          [1, -42],
          [0, -49],
        ],
        [
          [17, -46],
          [27, -48],
          [30, -54],
        ],
      ];
  return [
    group('nose-highlight', [ellipse([31, 2], [3, 2])], P.redLight),
    {
      ...group(
        'nose',
        [
          path(
            [
              [27, 1],
              [33, 1],
              [35, 5],
              [31, 9],
              [27, 6],
            ],
            true,
            0.18,
          ),
        ],
        isCalf ? P.shade : P.nose,
      ),
      cl: 'reindeer-nose',
    },
    group(
      'smile',
      [
        path(
          [
            [15, 12],
            [22, 13],
            [26, 10],
          ],
          false,
          0.18,
        ),
      ],
      undefined,
      P.ink,
      0.9,
    ),
    group(
      'eye-pose',
      [
        group(
          'gaze',
          [
            group('pupil-glint', [ellipse([8, -7], [1.8, 2])], P.white),
            group('pupil', [ellipse([9, -5], [4.2, 6.5])], P.ink),
          ],
          undefined,
          undefined,
          1,
          { ...identity(), p: gaze },
        ),
        group(
          'eye-white',
          [ellipse([9, -5], [isCalf ? 10 : 9, isCalf ? 12 : 10])],
          P.white,
        ),
      ],
      undefined,
      undefined,
      1,
      { ...identity([9, -5]), s: eye },
    ),
    group(
      'eyebrow',
      [
        path(
          [
            [3, -14],
            [8, -16],
            [14, -14],
          ],
          false,
          0.16,
        ),
      ],
      undefined,
      P.ink,
      1.4,
      { ...identity([9, -14]), r: brow },
    ),
    group(
      'muzzle',
      [
        path(
          [
            [11, -3],
            [20, -2],
            [29, 1],
            [32, 8],
            [24, 14],
            [12, 13],
            [7, 7],
          ],
          true,
          0.18,
        ),
      ],
      P.cream,
    ),
    group(
      'forehead-light',
      [
        path(
          [
            [-12, -17],
            [-2, -24],
            [10, -20],
            [15, -10],
            [8, 1],
            [-3, -2],
          ],
          true,
          0.16,
        ),
      ],
      P.light,
    ),
    group(
      'head',
      [
        path(
          isCalf
            ? [
                [-20, -4],
                [-16, -19],
                [-3, -25],
                [11, -20],
                [17, -5],
                [11, 14],
                [-4, 18],
                [-17, 10],
              ]
            : [
                [-18, -4],
                [-15, -19],
                [-2, -25],
                [12, -19],
                [18, -5],
                [10, 12],
                [-2, 16],
                [-14, 9],
              ],
          true,
          0.18,
        ),
      ],
      P.fur,
      P.shade,
      1,
    ),
    group(
      'ear-rig',
      [
        group(
          'ear-inner',
          [
            path(
              [
                [-14, -17],
                [-31, -23],
                [-24, -13],
                [-15, -12],
              ],
              true,
              0.14,
            ),
          ],
          P.cream,
        ),
        group(
          'ear',
          [
            path(
              [
                [-11, -18],
                [-34, -29],
                [-30, -13],
                [-19, -8],
                [-11, -12],
              ],
              true,
              0.16,
            ),
          ],
          P.fur,
          P.shade,
          0.9,
        ),
      ],
      undefined,
      undefined,
      1,
      { ...identity([-12, -13]), r: ear },
    ),
    group(
      'far-ear',
      [
        path(
          [
            [8, -20],
            [24, -31],
            [22, -18],
            [12, -13],
          ],
          true,
          0.15,
        ),
      ],
      P.shade,
    ),
    group(
      'antlers',
      antlers.map((v) => path(v, false, 0.08)),
      undefined,
      P.antler,
      isCalf ? 2.7 : 3.2,
    ),
  ];
};

export const tailArt = (): ReindeerShape[] => [
  group('tail-tip', [ellipse([-55, -74], [10, 7])], P.cream),
  group(
    'tail',
    [
      path(
        [
          [-43, -67],
          [-58, -77],
          [-58, -68],
          [-45, -61],
        ],
        true,
        0.15,
      ),
    ],
    P.fur,
  ),
];
export const scarfArt = (): ReindeerShape[] => [
  group(
    'scarf-hem',
    [
      path(
        [
          [26, -78],
          [16, -58],
        ],
        false,
      ),
    ],
    undefined,
    P.gold,
    2,
  ),
  group(
    'scarf-tail',
    [
      path(
        [
          [35, -93],
          [27, -93],
          [14, -59],
          [25, -56],
        ],
        true,
        0.1,
      ),
    ],
    P.red,
  ),
];
export const sleighArt = (): ReindeerShape[] => [
  group(
    'gold-trim',
    [
      path(
        [
          [-45, -31],
          [-25, -24],
          [30, -24],
          [46, -42],
        ],
        false,
        0.08,
      ),
    ],
    undefined,
    P.gold,
    3,
  ),
  group(
    'sleigh-light',
    [
      path(
        [
          [-37, -25],
          [-25, -21],
          [28, -21],
          [21, -15],
          [-29, -15],
        ],
        true,
        0.08,
      ),
    ],
    P.redLight,
  ),
  group(
    'sleigh',
    [
      path(
        [
          [-47, -35],
          [-27, -25],
          [32, -25],
          [48, -43],
          [38, -10],
          [-34, -10],
        ],
        true,
        0.1,
      ),
    ],
    P.red,
    P.shade,
  ),
  group(
    'runners',
    [
      path(
        [
          [-44, -5],
          [-37, 1],
          [37, 1],
          [49, -8],
        ],
        false,
        0.12,
      ),
      path(
        [
          [-27, -12],
          [-30, 0],
        ],
        false,
      ),
      path(
        [
          [26, -12],
          [29, 0],
        ],
        false,
      ),
    ],
    undefined,
    P.gold,
    3,
  ),
  group(
    'gift-ribbon',
    [
      path(
        [
          [-7, -63],
          [-7, -27],
        ],
        false,
      ),
      path(
        [
          [-27, -48],
          [13, -48],
        ],
        false,
      ),
    ],
    undefined,
    P.gold,
    4,
  ),
  group(
    'gift-bow',
    [
      path(
        [
          [-7, -63],
          [-22, -74],
          [-25, -63],
          [-7, -63],
          [5, -75],
          [11, -65],
          [-7, -63],
        ],
        false,
        0.1,
      ),
    ],
    undefined,
    P.gold,
    2,
  ),
  group(
    'gift',
    [
      path(
        [
          [-29, -62],
          [14, -62],
          [14, -27],
          [-29, -27],
        ],
        true,
        0.04,
      ),
    ],
    P.green,
    P.shade,
  ),
];
