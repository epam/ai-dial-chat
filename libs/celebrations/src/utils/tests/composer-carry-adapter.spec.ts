import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CelebrationComposerAnchorPlacement } from '../../models/celebration-pack';
import type {
  LottieComposition,
  LottieLayer,
} from '../../models/lottie-composition';
import { packSceneFixture } from '../../test-utils/pack-fixtures';
import {
  CelebrationAnchor,
  CelebrationAnchorEdge,
  CelebrationAnchorFallback,
  CelebrationCapability,
  CelebrationDirectionMode,
  CelebrationPlacementTemplate,
} from '../../types/celebration-pack';
import { isCelebrationSceneSupported } from '../celebration-pack-scene';
import {
  MAX_COMPOSER_CARRY_NODES,
  prepareComposerCarryScene,
} from '../composer-carry-adapter';
import { resolvePackSceneAdapter } from '../pack-scene-adapter';

const PLACEMENT: CelebrationComposerAnchorPlacement = {
  template: CelebrationPlacementTemplate.ComposerAnchorV1,
  anchor: CelebrationAnchor.Composer,
  anchorRect: { x: 340, y: 240, width: 520, height: 56 },
  edge: CelebrationAnchorEdge.Top,
  scale: { min: 0.7, max: 1 },
  fallback: CelebrationAnchorFallback.Poster,
};
const scene = packSceneFixture({
  placement: PLACEMENT,
  direction: CelebrationDirectionMode.None,
  requiredCapabilities: [
    CelebrationCapability.LottieLightSvgV1,
    CelebrationCapability.ComposerAnchorV1,
    CelebrationCapability.InteractionComposerCarryV1,
  ],
});
const fixture = (): LottieComposition => ({
  w: 1200,
  h: 360,
  fr: 30,
  ip: 0,
  op: 840,
  layers: [
    {
      ty: 3,
      ind: 1,
      nm: 'composer-carry',
      ks: {
        p: {
          a: 1,
          k: [
            { t: 0, s: [0, 0, 0] },
            { t: 420, s: [0, 0, 0] },
            { t: 570, s: [1000, 0, 0] },
            { t: 630, s: [1000, 0, 0] },
            { t: 720, s: [0, 0, 0] },
            { t: 840, s: [0, 0, 0] },
          ],
        },
      },
    },
    {
      ty: 3,
      ind: 2,
      parent: 1,
      nm: 'composer-decoration',
      ks: { p: { a: 0, k: [0, 0, 0] } },
    },
    {
      ty: 4,
      ind: 3,
      parent: 1,
      nm: 'bear',
      ks: { p: { a: 0, k: [-80, -120, 0] } },
    },
  ],
});
const originalAnimate = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'animate',
);
const animations: {
  element: Element;
  frames: Keyframe[];
  cancel: ReturnType<typeof vi.fn>;
  startTime: number | null;
}[] = [];
const disposers: (() => void)[] = [];
const dispose = () => {
  while (disposers.length) disposers.pop()?.();
};
let composer: HTMLDivElement;
let textarea: HTMLTextAreaElement;
let host: HTMLDivElement;
let rect: DOMRect;
let onResize: () => void = () => undefined;
const layerOf = (data: object, name: string): LottieLayer =>
  (data as LottieComposition).layers.find(
    (layer) => layer.nm === name,
  ) as LottieLayer;

const positionKeys = (data: LottieComposition) =>
  data.layers[0].ks?.p?.k as { s: number[] }[];

const withSide = (): LottieComposition => {
  const data = fixture();
  data.layers.push({
    ty: 3,
    ind: 4,
    parent: 1,
    nm: 'composer-side',
    ks: { p: { a: 0, k: [1, 0.5, 0] } },
  });
  data.layers[2].parent = 4;
  return data;
};

describe('composer carry adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    animations.length = 0;
    composer = document.createElement('div');
    composer.className = 'composer';
    textarea = document.createElement('textarea');
    textarea.value = 'My unsent draft';
    composer.append(textarea);
    host = document.createElement('div');
    document.body.append(composer, host);
    rect = new DOMRect(290, 400, 700, 100);
    vi.spyOn(composer, 'getBoundingClientRect').mockImplementation(() => rect);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      1280,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      800,
    );
    const computed = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const style = computed(element);
      return Object.assign(style, {
        visibility: style.visibility || 'visible',
        opacity: style.opacity || '1',
      });
    });
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value(this: Element, frames: Keyframe[]) {
        const animation = {
          element: this,
          frames,
          cancel: vi.fn(),
          startTime: null,
        };
        animations.push(animation);
        return animation;
      },
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          onResize = callback;
        }
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => {
    dispose();
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    if (originalAnimate)
      Object.defineProperty(Element.prototype, 'animate', originalAnimate);
    else Reflect.deleteProperty(Element.prototype, 'animate');
  });

  const play = () => {
    const adapter = resolvePackSceneAdapter(scene);
    if (!adapter) throw new Error('Carry adapter is not registered');
    const preparation = adapter.prepare(fixture(), PLACEMENT, {
      anchors: { composer: 'composer' },
      isMirrored: false,
      isMobile: false,
      direction: 'ltr',
    });
    const cancel = vi.fn(dispose);
    const context = {
      preparation,
      host,
      cancel,
      addDisposer: (fn: () => void) => disposers.push(fn),
    };
    adapter.onAnimationCreated(context);
    adapter.onPlaybackStarted?.({ ...context, timelineZeroMs: 4200 });
    return { preparation, cancel };
  };

  describe('composer carry preparation', () => {
    it('maps one authored track to a full viewport exit and fits only decoration width', () => {
      const source = fixture();
      const saved = structuredClone(source);
      const { data } = prepareComposerCarryScene(source, PLACEMENT, 'composer');
      const keys = layerOf(data, 'composer-carry').ks?.p?.k as {
        t: number;
        s: number[];
      }[];
      expect(keys.map((key) => key.s)).toEqual([
        [600, 240, 0],
        [600, 240, 0],
        [1622, 240, 0],
        [1622, 240, 0],
        [600, 240, 0],
        [600, 240, 0],
      ]);
      const fitted = layerOf(data, 'composer-decoration').ks?.s?.k as number[];
      expect(fitted[0]).toBeCloseTo((700 / 520) * 100);
      expect(fitted.slice(1)).toEqual([100, 100]);
      expect(layerOf(data, 'bear')).toEqual(source.layers[2]);
      expect(source).toEqual(saved);
      expect(animations).toHaveLength(0);
    });

    it('fits side contacts to measured width and height without moving or resizing the copy', () => {
      rect = new DOMRect(290, 400, 416, 100);
      const source = withSide();
      const saved = structuredClone(source);
      const prepared = prepareComposerCarryScene(source, PLACEMENT, 'composer');
      const legacy = prepareComposerCarryScene(
        fixture(),
        PLACEMENT,
        'composer',
      );
      expect(prepared.anchor?.scale).toBe(0.8);
      expect(layerOf(prepared.data, 'composer-side').ks?.p).toEqual({
        a: 0,
        k: [260, 62.5, 0],
      });
      for (const name of ['composer-carry', 'composer-decoration'])
        expect(layerOf(prepared.data, name).ks).toEqual(
          layerOf(legacy.data, name).ks,
        );
      expect(layerOf(prepared.data, 'bear')).toEqual(source.layers[2]);
      expect(source).toEqual(saved);
      expect(animations).toHaveLength(0);
    });

    it('rejects a bottom-docked corner before cloning or hiding the live composer', () => {
      rect = new DOMRect(18, 690, 324, 90);
      vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
        360,
      );
      const source = withSide();
      source.h = 330;
      layerOf(source, 'composer-side').ks = {
        p: { a: 0, k: [-1, 1, 0] },
      };
      const saved = structuredClone(source);
      const clone = vi.spyOn(composer, 'cloneNode');
      const placement = {
        ...PLACEMENT,
        anchorRect: { x: 210, y: 220, width: 300, height: 56 },
        scale: { min: 0.85, max: 1 },
      };
      expect(() =>
        prepareComposerCarryScene(source, placement, 'composer'),
      ).toThrow('No viewport room');
      expect(clone).not.toHaveBeenCalled();
      expect(animations).toHaveLength(0);
      expect(source).toEqual(saved);
      expect(textarea.value).toBe('My unsent draft');

      /* A pack without the optional slot keeps its previous eligibility. */
      const legacy = fixture();
      legacy.h = 330;
      expect(() =>
        prepareComposerCarryScene(legacy, placement, 'composer'),
      ).not.toThrow();
    });

    it('reserves the scaled declared extent and the viewport margin at the exact boundary', () => {
      rect = new DOMRect(290, 634, 416, 100);
      const source = withSide();
      /* Side y50px + authored tail120×0.8px + top634px leaves exactly20px. */
      expect(() =>
        prepareComposerCarryScene(source, PLACEMENT, 'composer'),
      ).not.toThrow();
      rect = new DOMRect(290, 635, 416, 100);
      expect(() =>
        prepareComposerCarryScene(source, PLACEMENT, 'composer'),
      ).toThrow('No viewport room');
    });

    it('checks later side attachments instead of only the initial position', () => {
      rect = new DOMRect(290, 610, 520, 100);
      const source = withSide();
      const side = layerOf(source, 'composer-side');
      side.ks = { p: { a: 0, k: [1, 0, 0] } };
      expect(() =>
        prepareComposerCarryScene(source, PLACEMENT, 'composer'),
      ).not.toThrow();
      side.ks = {
        p: {
          a: 1,
          k: [
            { t: 0, s: [1, 0, 0], h: 1 },
            { t: 420, s: [-1, 1, 0] },
          ],
        },
      };
      expect(() =>
        prepareComposerCarryScene(source, PLACEMENT, 'composer'),
      ).toThrow('No viewport room');
      expect(animations).toHaveLength(0);
    });

    it('maps authored lower corners in RTL without mirroring copied text or changing timing', () => {
      document.documentElement.dir = 'rtl';
      rect = new DOMRect(18, 450, 324, 90);
      vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
        360,
      );
      const source = withSide();
      const easing = { o: { x: [0.3], y: [0] }, i: { x: [0.7], y: [1] } };
      const keys = [
        { t: 0, s: [-1, 1, 0], h: 1 },
        { t: 585, s: [-1, 1, 0], ...easing },
        { t: 606, s: [1, 1, 0] },
      ];
      layerOf(source, 'composer-side').ks = { p: { a: 1, k: keys } };
      const saved = structuredClone(source);
      const prepared = prepareComposerCarryScene(
        source,
        {
          ...PLACEMENT,
          anchorRect: { x: 210, y: 220, width: 300, height: 56 },
          scale: { min: 0.85, max: 1 },
        },
        'composer',
      );
      expect(layerOf(prepared.data, 'composer-side').ks?.p?.k).toEqual([
        { ...keys[0], s: [-162, 90, 0] },
        { ...keys[1], s: [-162, 90, 0] },
        { ...keys[2], s: [162, 90, 0] },
      ]);
      expect(prepared.anchor?.isMirrored).toBe(false);
      expect(source).toEqual(saved);
      document.documentElement.removeAttribute('dir');
    });

    it.each([
      ['outside horizontal bounds', { a: 0, k: [1.01, 0.5, 0] }],
      ['outside vertical bounds', { a: 0, k: [1, -0.1, 0] }],
      ['depth', { a: 0, k: [1, 0.5, 1] }],
      ['non-finite position', { a: 0, k: [NaN, 0.5, 0] }],
      [
        'unsorted keys',
        {
          a: 1,
          k: [
            { t: 2, s: [1, 0.5, 0] },
            { t: 1, s: [-1, 0.5, 0] },
          ],
        },
      ],
      ['outside timeline', { a: 1, k: [{ t: 841, s: [1, 0.5, 0] }] }],
      ['empty track', { a: 1, k: [] }],
      [
        'too many keys',
        {
          a: 1,
          k: Array.from({ length: 65 }, (_, t) => ({ t, s: [1, 0.5, 0] })),
        },
      ],
      ['spatial curve', { a: 1, k: [{ t: 0, s: [1, 0.5, 0], to: [1, 0, 0] }] }],
      [
        'non-finite easing',
        {
          a: 1,
          k: [
            {
              t: 0,
              s: [1, 0.5, 0],
              o: { x: [0.3], y: [Infinity] },
              i: { x: [0.7], y: [1] },
            },
          ],
        },
      ],
      [
        'invalid later easing dimension',
        {
          a: 1,
          k: [
            {
              t: 0,
              s: [1, 0.5, 0],
              o: { x: [0.3, 'invalid'], y: [0, 0] },
              i: { x: [0.7, 0.7], y: [1, 1] },
            },
          ],
        },
      ],
    ])('rejects malformed side %s before copying', (_name, position) => {
      const source = withSide();
      layerOf(source, 'composer-side').ks = { p: position };
      expect(() =>
        prepareComposerCarryScene(source, PLACEMENT, 'composer'),
      ).toThrow();
      expect(animations).toHaveLength(0);
      expect(host.children).toHaveLength(0);
    });

    it.each([
      [
        'duplicate',
        (data: LottieComposition) =>
          data.layers.push(structuredClone(layerOf(data, 'composer-side'))),
      ],
      [
        'wrong parent',
        (data: LottieComposition) => {
          layerOf(data, 'composer-side').parent = 2;
        },
      ],
      [
        'non-null',
        (data: LottieComposition) => {
          layerOf(data, 'composer-side').ty = 4;
        },
      ],
      [
        'non-identity',
        (data: LottieComposition) => {
          const side = layerOf(data, 'composer-side');
          side.ks = { ...side.ks, s: { a: 0, k: [50, 100, 100] } };
        },
      ],
    ])('rejects a %s side slot before copying', (_name, mutate) => {
      const source = withSide();
      mutate(source);
      expect(() =>
        prepareComposerCarryScene(source, PLACEMENT, 'composer'),
      ).toThrow();
      expect(animations).toHaveLength(0);
    });

    it('keeps RTL text unmirrored on a narrow viewport', () => {
      document.documentElement.dir = 'rtl';
      rect = new DOMRect(18, 450, 324, 90);
      vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
        360,
      );
      const placement = {
        ...PLACEMENT,
        anchorRect: { x: 210, y: 220, width: 300, height: 56 },
        scale: { min: 0.85, max: 1 },
      };
      const prepared = prepareComposerCarryScene(
        fixture(),
        placement,
        'composer',
      );
      const keys = layerOf(prepared.data, 'composer-carry').ks?.p?.k as {
        s: number[];
      }[];
      expect(keys[2].s[0]).toBe(360 + 360 - 18 + 32);
      expect(prepared.anchor?.isMirrored).toBe(false);
      document.documentElement.removeAttribute('dir');
    });

    it.each([
      [
        'missing carry',
        (data: LottieComposition) => {
          data.layers.shift();
        },
      ],
      [
        'duplicate carry',
        (data: LottieComposition) => {
          data.layers.push(structuredClone(data.layers[0]));
        },
      ],
      [
        'missing decoration',
        (data: LottieComposition) => {
          data.layers.splice(1, 1);
        },
      ],
      [
        'no return',
        (data: LottieComposition) => {
          const keys = positionKeys(data);
          keys[keys.length - 1].s[0] = 2;
        },
      ],
      [
        'vertical travel',
        (data: LottieComposition) => {
          positionKeys(data)[2].s[1] = 1;
        },
      ],
      [
        'invalid easing',
        (data: LottieComposition) => {
          const keys = data.layers[0].ks?.p?.k as { o?: object; i?: object }[];
          keys[0].o = { x: [2], y: [0] };
          keys[0].i = { x: [0.6], y: [1] };
        },
      ],
      [
        'independent artwork',
        (data: LottieComposition) => {
          delete data.layers[2].parent;
        },
      ],
      [
        'scaled carrier',
        (data: LottieComposition) => {
          data.layers[0].ks = {
            ...data.layers[0].ks,
            s: { a: 0, k: [50, 100, 100] },
          };
        },
      ],
    ])('fails before hiding any input for %s', (_name, mutate) => {
      const data = fixture();
      mutate(data);
      expect(() =>
        prepareComposerCarryScene(data, PLACEMENT, 'composer'),
      ).toThrow();
      expect(animations).toHaveLength(0);
      expect(host.children).toHaveLength(0);
    });

    it('rejects absent, expanded, transformed and oversized composers before copying', () => {
      expect(() =>
        prepareComposerCarryScene(fixture(), PLACEMENT, 'missing'),
      ).toThrow();
      composer.style.transform = 'scale(2)';
      expect(() =>
        prepareComposerCarryScene(fixture(), PLACEMENT, 'composer'),
      ).toThrow('transformed');
      composer.style.transform = '';
      composer.style.setProperty('scale', '2');
      expect(() =>
        prepareComposerCarryScene(fixture(), PLACEMENT, 'composer'),
      ).toThrow('transformed');
      composer.style.removeProperty('scale');
      const button = document.createElement('button');
      button.setAttribute('aria-haspopup', 'menu');
      button.setAttribute('aria-expanded', 'true');
      composer.append(button);
      expect(() =>
        prepareComposerCarryScene(fixture(), PLACEMENT, 'composer'),
      ).toThrow('safely');
      button.remove();
      for (let i = 0; i < MAX_COMPOSER_CARRY_NODES; i++)
        composer.append(document.createElement('span'));
      expect(() =>
        prepareComposerCarryScene(fixture(), PLACEMENT, 'composer'),
      ).toThrow('safely');
      expect(animations).toHaveLength(0);
    });
  });

  describe('composer carry lifecycle', () => {
    it.each([
      'beforeinput',
      'input',
      'pointerdown',
      'focusin',
      'keydown',
      'compositionstart',
      'scroll',
    ])(
      'restores synchronously on %s without changing the focused draft',
      (event) => {
        textarea.focus();
        textarea.setSelectionRange(3, 8);
        const initialTimerCount = vi.getTimerCount();
        const markup = composer.outerHTML;
        const { cancel } = play();
        expect(host.querySelector('textarea')?.value).toBe('My unsent draft');
        expect(
          host.querySelector<HTMLElement>('[data-celebration-snapshot]')?.inert,
        ).toBe(true);
        expect(animations).toHaveLength(2);
        expect(animations.map((animation) => animation.startTime)).toEqual([
          4200, 4200,
        ]);
        expect(animations[0].frames[2].transform).toBe(
          'translate(1022px, 0px) rotate(0deg)',
        );
        textarea.dispatchEvent(new Event(event, { bubbles: true }));
        expect(cancel).toHaveBeenCalledOnce();
        expect(host.children).toHaveLength(0);
        expect(composer.outerHTML).toBe(markup);
        expect(document.activeElement).toBe(textarea);
        expect(textarea.value).toBe('My unsent draft');
        expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([
          3, 8,
        ]);
        animations.forEach((animation) =>
          expect(animation.cancel).toHaveBeenCalledOnce(),
        );
        expect(vi.getTimerCount()).toBe(initialTimerCount);
      },
    );

    it('restores on geometry invalidation and finite completion', () => {
      const first = play();
      rect = new DOMRect(291, 400, 700, 100);
      onResize();
      expect(first.cancel).toHaveBeenCalledOnce();
      expect(host.children).toHaveLength(0);
      play();
      vi.advanceTimersByTime(28000);
      expect(host.children).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('composer carry capability', () => {
    it('allows only its anchored, non-mirrored interaction combination', () => {
      expect(isCelebrationSceneSupported(scene)).toBe(true);
      expect(
        isCelebrationSceneSupported({
          ...scene,
          direction: CelebrationDirectionMode.Mirror,
        }),
      ).toBe(false);
      expect(
        isCelebrationSceneSupported({
          ...scene,
          placement: packSceneFixture().placement,
        }),
      ).toBe(false);
      for (const other of [
        CelebrationCapability.InteractionCatBorrowV1,
        CelebrationCapability.InteractionComposerOutlineV1,
        CelebrationCapability.InteractionCopyTrackV1,
      ])
        expect(
          isCelebrationSceneSupported({
            ...scene,
            requiredCapabilities: [...scene.requiredCapabilities, other],
          }),
        ).toBe(false);
    });
  });
});
