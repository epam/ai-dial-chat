/** Native Lottie property, fixed or authored in keyframes. */
export interface StarProperty {
  /** Animation flag. */ a: number;
  /** Native value/keys. */ k: unknown;
}
/** Native Lottie vector shape. */
export interface StarShape {
  /** Shape kind. */ ty: string;
  /** Authoring name. */ nm?: string;
  /** Nested shapes. */ it?: StarShape[];
  [key: string]: unknown;
}
/** Native transform shared by a layer or a vector group. */
export interface StarTransform {
  /** Anchor. */ a: StarProperty;
  /** Position. */ p: StarProperty;
  /** Scale. */ s: StarProperty;
  /** Rotation. */ r: StarProperty;
  /** Opacity. */ o: StarProperty;
}
/** A fixed native property. */
export const fixed = (k: unknown): StarProperty => ({ a: 0, k });
/** An identity transform for native vector data. */
export const identity = (): StarTransform => ({
  a: fixed([0, 0]),
  p: fixed([0, 0]),
  s: fixed([100, 100]),
  r: fixed(0),
  o: fixed(100),
});
const ink = '#182226';
const color = (hex: string) =>
  [1, 3, 5].map((n) => parseInt(hex.slice(n, n + 2), 16) / 255).concat(1);

/** A vector group with optional transform and a single shared fill. */
export const group = (
  nm: string,
  shapes: StarShape[],
  hex?: string,
  transform = identity(),
): StarShape => ({
  ty: 'gr',
  nm,
  it: [
    ...shapes,
    ...(hex ? [{ ty: 'fl', c: fixed(color(hex)), o: fixed(100) }] : []),
    { ty: 'tr', ...transform },
  ],
});
const ellipse = (x: number, y: number, w: number, h: number): StarShape => ({
  ty: 'el',
  p: fixed([x, y]),
  s: fixed([w, h]),
  d: 1,
});
const path = (points: number[][], rounded = false): StarShape => ({
  ty: 'sh',
  ks: fixed({
    v: points,
    i: points.map((_, i) =>
      rounded
        ? [
            (points[(i + points.length - 1) % points.length][0] -
              points[(i + 1) % points.length][0]) *
              0.13,
            (points[(i + points.length - 1) % points.length][1] -
              points[(i + 1) % points.length][1]) *
              0.13,
          ]
        : [0, 0],
    ),
    o: points.map((_, i) =>
      rounded
        ? [
            (points[(i + 1) % points.length][0] -
              points[(i + points.length - 1) % points.length][0]) *
              0.13,
            (points[(i + 1) % points.length][1] -
              points[(i + points.length - 1) % points.length][1]) *
              0.13,
          ]
        : [0, 0],
    ),
    c: true,
  }),
});

/** Head, hat, glasses and beak share a neck pivot; the belly stays on the torso. */
const penguinHeadArt = (): StarShape[] => [
  group(
    'santa-hat',
    [
      group(
        'hat-pompom',
        [ellipse(-30, -123, 11, 11), ellipse(-32, -125, 4, 4)],
        '#f1ece2',
      ),
      group(
        'hat-brim-light',
        [
          path(
            [
              [-25, -99],
              [-14, -102],
              [9, -102],
              [25, -99],
              [13, -98],
              [-13, -98],
            ],
            true,
          ),
        ],
        '#fcfaf4',
      ),
      group('hat-brim', [ellipse(0, -97, 54, 10)], '#dfded7'),
      group(
        'hat-fold',
        [
          path(
            [
              [-9, -126],
              [-21, -127],
              [-30, -123],
              [-24, -117],
              [-17, -114],
              [-12, -121],
            ],
            true,
          ),
        ],
        '#8d343c',
      ),
      group(
        'hat-shade',
        [
          path(
            [
              [6, -128],
              [16, -121],
              [23, -101],
              [12, -104],
              [10, -117],
            ],
            true,
          ),
        ],
        '#9d3a43',
      ),
      group(
        'hat-fabric',
        [
          path(
            [
              [-25, -100],
              [-22, -112],
              [-12, -123],
              [2, -128],
              [12, -126],
              [20, -114],
              [24, -100],
            ],
            true,
          ),
        ],
        '#b3434a',
      ),
    ],
    undefined,
    {
      ...identity(),
      a: fixed([0, -98]),
      p: fixed([0, -98]),
    },
  ),
  group(
    'beak-light',
    [
      path(
        [
          [-7, -70],
          [0, -72],
          [7, -70],
          [5, -67],
          [-5, -67],
        ],
        true,
      ),
    ],
    '#f4f1e9',
  ),
  group(
    'beak-shadow',
    [
      path(
        [
          [-7, -68],
          [0, -62],
          [7, -68],
          [0, -66],
        ],
        true,
      ),
    ],
    '#c8c9c4',
  ),
  group(
    'sunglasses',
    [
      group(
        'lens-glints',
        [
          path(
            [
              [-20, -86],
              [-14, -87],
              [-17, -83],
              [-20, -82],
            ],
            true,
          ),
          path(
            [
              [4, -86],
              [10, -87],
              [7, -83],
              [4, -82],
            ],
            true,
          ),
        ],
        '#849593',
      ),
      group(
        'lenses',
        [
          { ty: 'rc', p: fixed([-12, -82]), s: fixed([18, 11]), r: fixed(3.8) },
          { ty: 'rc', p: fixed([12, -82]), s: fixed([18, 11]), r: fixed(3.8) },
        ],
        '#0a1013',
      ),
      group(
        'frames',
        [
          { ty: 'rc', p: fixed([-12, -82]), s: fixed([22, 15]), r: fixed(5) },
          { ty: 'rc', p: fixed([12, -82]), s: fixed([22, 15]), r: fixed(5) },
          path([
            [-2, -83],
            [2, -83],
            [2, -80],
            [-2, -80],
          ]),
        ],
        '#667875',
      ),
    ],
    undefined,
    {
      ...identity(),
      a: fixed([0, -80]),
      p: fixed([0, -80]),
    },
  ),
  group(
    'head-rim',
    [
      path(
        [
          [-24, -84],
          [-26, -75],
          [-20, -64],
          [-8, -61],
          [-9, -71],
          [-16, -79],
        ],
        true,
      ),
      path(
        [
          [24, -84],
          [26, -75],
          [20, -64],
          [8, -61],
          [9, -71],
          [16, -79],
        ],
        true,
      ),
    ],
    '#d8dfd8',
  ),
  group(
    'head-light',
    [
      path(
        [
          [-24, -86],
          [-18, -97],
          [-7, -102],
          [10, -101],
          [-7, -93],
          [-18, -79],
        ],
        true,
      ),
    ],
    '#343e42',
  ),
  group('head', [ellipse(0, -78, 57, 51)], ink),
];

/** Monochrome reference silhouette with independently articulated head and flipper. */
export const penguinArt = (): StarShape[] => [
  group('head-rig', penguinHeadArt(), undefined, {
    ...identity(),
    a: fixed([0, -72]),
    p: fixed([0, -72]),
  }),
  group(
    'belly-light',
    [
      path(
        [
          [-18, -54],
          [-23, -40],
          [-23, -27],
          [-17, -15],
          [-5, -7],
          [-15, -27],
          [-12, -44],
        ],
        true,
      ),
    ],
    '#fffefa',
  ),
  group(
    'belly',
    [
      path(
        [
          [-17, -57],
          [-26, -40],
          [-26, -22],
          [-17, -9],
          [-3, -4],
          [13, -7],
          [25, -21],
          [25, -39],
          [16, -57],
          [0, -54],
        ],
        true,
      ),
    ],
    '#e9ece8',
  ),
  group(
    'belly-edge',
    [
      path(
        [
          [18, -52],
          [26, -39],
          [26, -27],
          [18, -12],
          [8, -5],
          [19, -27],
        ],
        true,
      ),
    ],
    '#c7d0ce',
  ),
  group(
    'far-flipper-rim',
    [
      path(
        [
          [-28, -61],
          [-38, -56],
          [-45, -39],
          [-47, -22],
          [-44, -17],
          [-43, -24],
          [-43, -39],
          [-35, -55],
        ],
        true,
      ),
    ],
    '#64767b',
  ),
  group(
    'far-flipper',
    [
      path(
        [
          [-27, -61],
          [-36, -57],
          [-43, -41],
          [-46, -22],
          [-43, -17],
          [-35, -25],
          [-24, -44],
        ],
        true,
      ),
    ],
    '#172125',
  ),
  group(
    'body-rim-left',
    [
      path(
        [
          [-25, -64],
          [-34, -49],
          [-35, -30],
          [-28, -13],
          [-29, -30],
          [-30, -48],
          [-23, -61],
        ],
        true,
      ),
    ],
    '#64757a',
  ),
  group(
    'body-rim-right',
    [
      path(
        [
          [24, -64],
          [33, -49],
          [35, -30],
          [27, -13],
          [30, -31],
          [29, -49],
          [22, -62],
        ],
        true,
      ),
    ],
    '#4a5b60',
  ),
  group(
    'body-light',
    [
      path(
        [
          [-24, -62],
          [-32, -47],
          [-33, -30],
          [-27, -15],
          [-17, -7],
          [-24, -30],
          [-23, -47],
        ],
        true,
      ),
    ],
    '#3f4e53',
  ),
  group(
    'body',
    [
      path(
        [
          [-11, -73],
          [-25, -65],
          [-34, -48],
          [-33, -27],
          [-24, -9],
          [-12, -3],
          [12, -3],
          [25, -9],
          [34, -28],
          [32, -49],
          [24, -66],
          [11, -73],
        ],
        true,
      ),
    ],
    '#10191d',
  ),
];
/** Near flipper, with an articulated shoulder and grip at local (28, 0). */
export const flipperArt = (): StarShape[] => [
  group(
    'flipper-rim',
    [
      path(
        [
          [-2, -11],
          [7, -14],
          [18, -10],
          [29, -2],
          [28, 0],
          [17, -7],
          [7, -11],
          [0, -8],
        ],
        true,
      ),
    ],
    '#6a7b80',
  ),
  group(
    'flipper-light',
    [
      path(
        [
          [0, -10],
          [10, -9],
          [22, -3],
          [28, -1],
          [15, -4],
          [3, -3],
        ],
        true,
      ),
    ],
    '#46595e',
  ),
  group(
    'flipper',
    [
      path(
        [
          [-2, -11],
          [7, -13],
          [18, -9],
          [29, -1],
          [28, 2],
          [17, 7],
          [7, 8],
          [-2, 5],
        ],
        true,
      ),
    ],
    '#111b1f',
  ),
];
/** Small pale feet pivot at y=0 for alternating planted steps. */
export const leftFootArt = (): StarShape[] => [
  group(
    'left-foot-light',
    [
      path(
        [
          [-10, -5],
          [-3, -7],
          [8, -5],
          [10, -1],
          [-10, 0],
        ],
        true,
      ),
    ],
    '#f4f4ed',
  ),
  group(
    'left-foot-shadow',
    [
      path(
        [
          [-10, -2],
          [10, -2],
          [7, 1],
          [-9, 1],
        ],
        true,
      ),
    ],
    '#aeb8b7',
  ),
];
/** Small pale feet pivot at y=0 for alternating planted steps. */
export const rightFootArt = (): StarShape[] => [
  group(
    'right-foot-light',
    [
      path(
        [
          [-8, -5],
          [3, -7],
          [10, -5],
          [10, 0],
          [-10, -1],
        ],
        true,
      ),
    ],
    '#f4f4ed',
  ),
  group(
    'right-foot-shadow',
    [
      path(
        [
          [-10, -2],
          [10, -2],
          [9, 1],
          [-7, 1],
        ],
        true,
      ),
    ],
    '#aeb8b7',
  ),
];
/** Weighted pot stays level while the trunk bends. */
export const potArt = (): StarShape[] => [
  group(
    'pot-rim',
    [{ ty: 'rc', p: fixed([0, -25]), s: fixed([40, 8]), r: fixed(2) }],
    '#be8b67',
  ),
  group(
    'pot-light',
    [
      path(
        [
          [-18, -24],
          [-4, -23],
          [-7, -3],
          [-13, -3],
        ],
        true,
      ),
    ],
    '#bd795a',
  ),
  group(
    'pot',
    [
      path(
        [
          [-18, -25],
          [18, -25],
          [12, -2],
          [-12, -2],
        ],
        true,
      ),
    ],
    '#8f5643',
  ),
];
/** Fir boughs keep an irregular silhouette; the crown is exactly y=-height. */
export const treeArt = (height: number): StarShape[] => [
  group(
    'snow',
    [
      path(
        [
          [0, -height],
          [-6, -height + 20],
          [-15, -height + 31],
          [-7, -height + 28],
          [0, -height + 32],
          [8, -height + 27],
          [16, -height + 31],
          [5, -height + 17],
        ],
        true,
      ),
      path(
        [
          [-27, -height * 0.64],
          [-13, -height * 0.65],
          [-2, -height * 0.63],
        ],
        true,
      ),
      path(
        [
          [11, -height * 0.43],
          [30, -height * 0.44],
          [39, -height * 0.43],
        ],
        true,
      ),
    ],
    '#e6ece8',
  ),
  group(
    'branch-light',
    [
      path(
        [
          [0, -height + 10],
          [-9, -height * 0.82],
          [-21, -height * 0.7],
          [-14, -height * 0.68],
          [-32, -height * 0.53],
          [-24, -height * 0.49],
          [-46, -35],
          [-28, -33],
          [-6, -40],
          [-1, -height * 0.65],
        ],
        true,
      ),
    ],
    '#477f6c',
  ),
  group(
    'branch-shadow',
    [
      path(
        [
          [3, -height + 18],
          [10, -height * 0.8],
          [21, -height * 0.69],
          [15, -height * 0.65],
          [33, -height * 0.5],
          [26, -height * 0.47],
          [48, -34],
          [28, -32],
          [9, -38],
        ],
        true,
      ),
    ],
    '#244f44',
  ),
  group(
    'tree',
    [
      path(
        [
          [0, -height],
          [10, -height * 0.82],
          [24, -height * 0.69],
          [16, -height * 0.65],
          [36, -height * 0.51],
          [27, -height * 0.47],
          [52, -33],
          [27, -30],
          [0, -35],
          [-28, -31],
          [-52, -35],
          [-25, -height * 0.5],
          [-35, -height * 0.54],
          [-15, -height * 0.68],
          [-23, -height * 0.72],
          [-8, -height * 0.84],
        ],
        true,
      ),
    ],
    '#2d6754',
  ),
  group(
    'trunk',
    [
      path([
        [-4, -46],
        [4, -46],
        [4, -24],
        [-4, -24],
      ]),
    ],
    '#68543e',
  ),
];
/** A small warm-metal star, detailed only enough to read at mobile size. */
export const starArt = (): StarShape[] => {
  const starPoints = (outer: number, inner: number) =>
    Array.from({ length: 10 }, (_, n) => {
      const angle = -Math.PI / 2 + (n * Math.PI) / 5;
      const radius = n % 2 ? inner : outer;
      return [Math.cos(angle) * radius, Math.sin(angle) * radius];
    });
  return [
    group('star-light', [path(starPoints(11.5, 5.2))], '#f5d27a'),
    group('star', [path(starPoints(14, 6.2))], '#bd8e45'),
  ];
};
/** A folded paper nugget that takes over as the borrowed control disappears. */
export const crumpledPaperArt = (): StarShape[] => [
  group(
    'paper-folds',
    [
      path(
        [
          [-10, -5],
          [-3, -11],
          [7, -8],
          [12, 1],
          [5, 10],
          [-6, 9],
          [-12, 3],
        ],
        true,
      ),
      path([
        [-8, -3],
        [-2, 1],
        [3, -7],
      ]),
      path([
        [0, 3],
        [7, 8],
        [9, -1],
      ]),
    ],
    '#d7d5ca',
  ),
  group('paper-light', [ellipse(-3, -5, 8, 5)], '#f4f1e8'),
];
/** Simple snowy support, never an effect or a filter. */
export const snowArt = (width: number, height: number): StarShape[] => [
  group('snow', [ellipse(0, -height / 2, width, height)], '#dcebed'),
];
