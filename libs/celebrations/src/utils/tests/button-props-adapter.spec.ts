import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CelebrationComposerAnchorPlacement } from '../../models/celebration-pack';
import type { LottieComposition } from '../../models/lottie-composition';
import source from '../../stories/fixtures/snow-circus.desktop.lottie.json';
import { snowCircusScene } from '../../test-utils/snow-circus';
import { CelebrationDirectionMode } from '../../types/celebration-pack';
import { PackSceneCompanionKind } from '../../types/pack-scene';
import { prepareButtonPropsScene } from '../button-props-adapter';
import { isCelebrationSceneSupported } from '../celebration-pack-scene';
import { resolvePackSceneAdapter } from '../pack-scene-adapter';

const placement =
  snowCircusScene.placement as CelebrationComposerAnchorPlacement;
const animations: {
  frames: Keyframe[];
  cancel: ReturnType<typeof vi.fn>;
  startTime: number | null;
}[] = [];
const disposers: (() => void)[] = [];
const dispose = () => {
  while (disposers.length) disposers.pop()?.();
};
let composer: HTMLDivElement;
let buttons: HTMLButtonElement[];
let host: HTMLDivElement;

describe('button props', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    animations.length = 0;
    composer = document.createElement('div');
    composer.className = 'composer';
    const editor = document.createElement('textarea');
    editor.value = 'unsent draft';
    composer.append(editor);
    buttons = [0, 1].map((i) => {
      const button = document.createElement('button');
      button.textContent = String(i);
      composer.append(button);
      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(560 + i * 64, 430, 40, 40),
      );
      return button;
    });
    host = document.createElement('div');
    document.body.append(composer, host);
    vi.spyOn(composer, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(380, 400, 520, 100),
    );
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
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    Object.defineProperty(Element.prototype, 'getAnimations', {
      configurable: true,
      value: () => [],
    });
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value: (_frames: Keyframe[]) => {
        const animation = { frames: _frames, cancel: vi.fn(), startTime: null };
        animations.push(animation);
        return animation;
      },
    });
  });
  afterEach(() => {
    dispose();
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    Reflect.deleteProperty(Element.prototype, 'animate');
    Reflect.deleteProperty(Element.prototype, 'getAnimations');
  });

  const prepare = (data: unknown = source, isMobile = false) =>
    prepareButtonPropsScene(
      data,
      placement,
      { composer: 'composer' },
      isMobile,
    );
  const play = () => {
    const adapter = resolvePackSceneAdapter(snowCircusScene)!;
    const preparation = prepare();
    const cancel = vi.fn(dispose);
    const context = {
      preparation,
      host,
      cancel,
      addDisposer: (fn: () => void) => disposers.push(fn),
    };
    adapter.onAnimationCreated(context);
    adapter.onPlaybackStarted?.({ ...context, timelineZeroMs: 1234 });
    return preparation;
  };
  it('dispatches only the anchored non-mirrored capability', () => {
    expect(isCelebrationSceneSupported(snowCircusScene)).toBe(true);
    expect(resolvePackSceneAdapter(snowCircusScene)).toBeDefined();
    expect(
      isCelebrationSceneSupported({
        ...snowCircusScene,
        direction: CelebrationDirectionMode.Mirror,
      }),
    ).toBe(false);
  });
  it('binds two props without mutating cached art or live controls', () => {
    const saved = JSON.stringify(source);
    const prepared = prepare();
    expect(prepared.companion?.kind).toBe(PackSceneCompanionKind.ButtonProps);
    if (prepared.companion?.kind !== PackSceneCompanionKind.ButtonProps)
      throw new Error('wrong adapter');
    expect(prepared.companion.watched).toHaveLength(2);
    expect(JSON.stringify(source)).toBe(saved);
    expect(buttons.every((button) => button.style.opacity === '')).toBe(true);
    expect(
      (prepared.data as LottieComposition).layers.filter(({ nm }) =>
        nm?.startsWith('bp-drawn:'),
      ),
    ).toHaveLength(0);
  });
  it('keeps one copy on mobile and draws the second prop', () => {
    const prepared = prepare(source, true);
    if (prepared.companion?.kind !== PackSceneCompanionKind.ButtonProps)
      throw new Error('wrong adapter');
    expect(prepared.companion.watched).toHaveLength(1);
    expect(
      (prepared.data as LottieComposition).layers.some(
        ({ nm }) => nm === 'bp-drawn:1',
      ),
    ).toBe(true);
  });
  it('chooses both small buttons beside an ineligible model selector', () => {
    vi.spyOn(buttons[0], 'getBoundingClientRect').mockReturnValue(
      new DOMRect(550, 430, 40, 40),
    );
    vi.spyOn(buttons[1], 'getBoundingClientRect').mockReturnValue(
      new DOMRect(690, 430, 40, 40),
    );
    const selector = document.createElement('button');
    selector.textContent = 'Model';
    composer.append(selector);
    vi.spyOn(selector, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(590, 430, 100, 40),
    );
    const prepared = prepare();
    if (prepared.companion?.kind !== PackSceneCompanionKind.ButtonProps)
      throw new Error('wrong adapter');
    expect(prepared.companion.watched.map(({ element }) => element)).toEqual(
      buttons,
    );
  });
  it.each([20, 300])(
    'uses drawn snow for an unsafe edge contact at x=%s',
    (left) => {
      vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
        360,
      );
      vi.spyOn(composer, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(12, 400, 336, 100),
      );
      vi.spyOn(buttons[0], 'getBoundingClientRect').mockReturnValue(
        new DOMRect(left, 420, 40, 40),
      );
      buttons[1].disabled = true;
      const prepared = prepare(source, true);
      expect(prepared.companion).toMatchObject({ watched: [], copies: [] });
      const data = prepared.data as LottieComposition;
      const positions = data.layers.find(({ nm }) => nm === 'bp-stage')!.ks!.p!
        .k as { s: number[] }[];
      expect(positions.every(({ s }) => s.every((value) => value === 0))).toBe(
        true,
      );
      expect(buttons[0].style.opacity).toBe('');
      expect(
        data.layers.filter(({ nm }) => nm?.startsWith('bp-drawn:')),
      ).toHaveLength(2);
    },
  );
  it('uses the full composition envelope when bounds are absent', () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      520,
    );
    vi.spyOn(composer, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(12, 300, 496, 100),
    );
    vi.spyOn(buttons[0], 'getBoundingClientRect').mockReturnValue(
      new DOMRect(250, 330, 40, 40),
    );
    buttons[1].disabled = true;
    expect(prepare().companion).toMatchObject({
      watched: [{ element: buttons[0] }],
    });
    const data = structuredClone(source) as LottieComposition;
    data.layers = data.layers.filter(({ nm }) => !nm?.startsWith('bp-bounds:'));
    expect(prepare(data).companion).toMatchObject({ watched: [], copies: [] });
  });
  it('keeps blended contacts and their interpolated motion inside the viewport', () => {
    const sourceCopy = structuredClone(source) as LottieComposition;
    const weights = sourceCopy.layers
      .filter(({ nm }) => nm?.startsWith('bp-weight:'))
      .map((layer) => layer.ks!.o!.k as { t: number; s: number[] }[]);
    const key = weights[0].findIndex(({ t }) => t > 160 && t < 600);
    expect(key).toBeGreaterThan(-1);
    weights.forEach((track) => {
      track[key].s[0] = 50;
    });
    const prepared = prepare(sourceCopy);
    if (prepared.companion?.kind !== PackSceneCompanionKind.ButtonProps)
      throw new Error('wrong adapter');
    expect(prepared.companion.watched).toHaveLength(2);
    const { origin, pivot, scale, viewportWidth, viewportHeight } =
      prepared.anchor!;
    const data = prepared.data as LottieComposition;
    const positions = data.layers.find(({ nm }) => nm === 'bp-stage')!.ks!.p!
      .k as { s: number[] }[];
    const corners = sourceCopy.layers
      .filter(({ nm }) => nm?.startsWith('bp-bounds:'))
      .map((layer) => layer.ks!.p!.k as number[]);
    for (let i = 0; i < positions.length - 1; i++) {
      for (const share of [0, 0.25, 0.5, 0.75, 1]) {
        const delta = positions[i].s.map(
          (value, axis) => value + share * (positions[i + 1].s[axis] - value),
        );
        for (const [x, y] of corners) {
          const left = origin.x + (x + delta[0] - pivot.x) * scale;
          const top = origin.y + (y + delta[1] - pivot.y) * scale;
          expect(left).toBeGreaterThanOrEqual(0);
          expect(left).toBeLessThanOrEqual(viewportWidth);
          expect(top).toBeGreaterThanOrEqual(0);
          expect(top).toBeLessThanOrEqual(viewportHeight);
        }
      }
    }
  });
  it.each(['missing', 'inverted', 'outside', 'animated'])(
    'rejects %s artwork bounds',
    (mutation) => {
      const data = structuredClone(source) as LottieComposition;
      const min = data.layers.find(({ nm }) => nm === 'bp-bounds:min')!;
      if (mutation === 'missing')
        data.layers = data.layers.filter(({ nm }) => nm !== 'bp-bounds:max');
      if (mutation === 'inverted') min.ks!.p = { a: 0, k: [450, 100, 0] };
      if (mutation === 'outside') min.ks!.p = { a: 0, k: [-1, 100, 0] };
      if (mutation === 'animated') min.ks!.p = { a: 1, k: [] };
      expect(() => prepare(data)).toThrow(/bounds/);
      expect(animations).toHaveLength(0);
    },
  );
  it('uses drawn snow when buttons are focused, expanded, too large or transformed', () => {
    buttons[0].focus();
    buttons[1].setAttribute('aria-expanded', 'true');
    const prepared = prepare();
    if (prepared.companion?.kind !== PackSceneCompanionKind.ButtonProps)
      throw new Error('wrong adapter');
    expect(prepared.companion.watched).toHaveLength(0);
    buttons[0].blur();
    buttons[1].removeAttribute('aria-expanded');
    buttons[0].style.transform = 'scale(2)';
    vi.spyOn(buttons[1], 'getBoundingClientRect').mockReturnValue(
      new DOMRect(600, 430, 100, 40),
    );
    expect(prepare().companion).toMatchObject({ watched: [] });
  });
  it('starts copies on one clock and returns them to their measured centers', () => {
    play();
    expect(animations).toHaveLength(4);
    expect(animations.every(({ startTime }) => startTime === 1234)).toBe(true);
    for (const [index, restore] of [
      [0, 23],
      [2, 24],
    ]) {
      const frame = animations[index].frames.find(
        ({ offset }) => Math.abs(Number(offset) - restore / 26) < 0.00001,
      );
      expect(frame?.transform).toBe('translate(0px, 0px)');
    }
    document.dispatchEvent(new Event('input', { bubbles: true }));
    expect(animations.every(({ cancel }) => cancel.mock.calls.length > 0)).toBe(
      true,
    );
    expect(composer.querySelector('textarea')?.value).toBe('unsent draft');
  });
  it.each(['duplicate', 'nan', 'return', 'scale', 'clock'])(
    'rejects malformed %s before snapshotting',
    (mutation) => {
      const data = structuredClone(source) as LottieComposition;
      const prop = data.layers.find(({ nm }) => nm === 'bp-prop:0')!;
      const keys = prop.ks!.p!.k as { t: number; s: number[] }[];
      if (mutation === 'duplicate') data.layers.push(structuredClone(prop));
      if (mutation === 'nan') keys[1].s[0] = NaN;
      if (mutation === 'return') keys.find(({ t }) => t === 690)!.s[0] += 10;
      if (mutation === 'scale') prop.ks!.s = { a: 0, k: [90, 100, 100] };
      if (mutation === 'clock') keys[1].t += 1;
      expect(() => prepare(data)).toThrow(/Malformed button props/);
      expect(host.children).toHaveLength(0);
      expect(animations).toHaveLength(0);
    },
  );
});
