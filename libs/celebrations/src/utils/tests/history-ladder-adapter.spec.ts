import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CelebrationViewportStagePlacement } from '../../models/celebration-pack';
import type { LottieComposition } from '../../models/lottie-composition';
import {
  historyLadderFixture,
  historyViewportFixture,
} from '../../test-utils/history-ladder';
import { packSceneFixture } from '../../test-utils/pack-fixtures';
import {
  CelebrationCapability,
  CelebrationDirectionMode,
  CelebrationPlacementTemplate,
  CelebrationStageAlign,
  CelebrationStageFit,
} from '../../types/celebration-pack';
import {
  HistoryLadderAnchor,
  HistoryLadderMode,
} from '../../types/history-ladder';
import { PackSceneCompanionKind } from '../../types/pack-scene';
import { isCelebrationSceneSupported } from '../celebration-pack-scene';
import {
  onHistoryLadderAnimationCreated,
  onHistoryLadderPlaybackStarted,
  prepareHistoryLadderScene,
} from '../history-ladder-adapter';
import { resolvePackSceneAdapter } from '../pack-scene-adapter';

const placement: CelebrationViewportStagePlacement = {
  template: CelebrationPlacementTemplate.ViewportStageV1,
  fit: CelebrationStageFit.Contain,
  align: CelebrationStageAlign.Center,
};
const anchors = {
  composer: 'composer',
  historyContainer: 'history',
  historyRowLink: 'a',
};
const scene = () =>
  packSceneFixture({
    placement,
    direction: CelebrationDirectionMode.None,
    requiredCapabilities: [
      CelebrationCapability.LottieLightSvgV1,
      CelebrationCapability.ViewportStageV1,
      CelebrationCapability.InteractionHistoryLadderV1,
    ],
  });

describe('history ladder adapter', () => {
  let composer: HTMLElement;
  let history: HTMLElement;
  let rows: HTMLElement[];
  let disposers: (() => void)[];
  let animations: {
    target: Element;
    frames: Keyframe[];
    animation: Animation;
  }[];
  let notifyResize: () => void;
  const measured = (tag: string, rect: DOMRect, className = '') => {
    const element = document.createElement(tag);
    element.className = className;
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect);
    return element;
  };
  const prepare = (
    data = historyLadderFixture(),
    direction: 'ltr' | 'rtl' = 'ltr',
  ) =>
    prepareHistoryLadderScene(data, placement, {
      anchors,
      direction,
      isMobile: false,
      isMirrored: false,
    });
  const dispose = () => {
    for (const stop of disposers.splice(0)) stop();
  };
  const install = (preparation: ReturnType<typeof prepare>) => {
    const host = document.createElement('div');
    document.body.append(host);
    const cancel = vi.fn(dispose);
    const context = {
      preparation,
      host,
      cancel,
      addDisposer: (stop: () => void) => disposers.push(stop),
    };
    onHistoryLadderAnimationCreated(context);
    return context;
  };

  beforeEach(() => {
    disposers = [];
    animations = [];
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      1280,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      900,
    );
    vi.stubGlobal('visualViewport', undefined);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notifyResize = callback;
        }
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value: vi.fn(function (this: Element, frames: Keyframe[]) {
        const animation = {
          cancel: vi.fn(),
          startTime: null,
        } as unknown as Animation;
        animations.push({ target: this, frames, animation });
        return animation;
      }),
    });
    composer = measured('div', new DOMRect(500, 700, 600, 60), 'composer');
    composer.innerHTML = '<textarea>Untouched draft</textarea>';
    history = measured('ul', new DOMRect(20, 100, 300, 500), 'history');
    rows = Array.from({ length: 6 }, (_, index) => {
      const row = measured('li', new DOMRect(32, 120 + index * 40, 268, 32));
      const link = document.createElement('a');
      link.href = `#conversation-${index}`;
      link.textContent = `Conversation ${index}`;
      row.append(link);
      history.append(row);
      return row;
    });
    document.body.append(history, composer);
  });
  afterEach(() => {
    dispose();
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('requires only the explicit viewport capability and one interaction', () => {
    expect(isCelebrationSceneSupported(scene())).toBe(true);
    expect(resolvePackSceneAdapter(scene())?.watchedAnchors).toContain(
      'historyContainer',
    );
    expect(
      isCelebrationSceneSupported({
        ...scene(),
        direction: CelebrationDirectionMode.Mirror,
      }),
    ).toBe(false);
    expect(
      isCelebrationSceneSupported({
        ...scene(),
        requiredCapabilities: [
          ...scene().requiredCapabilities,
          CelebrationCapability.InteractionCopyTrackV1,
        ],
      }),
    ).toBe(false);
    expect(
      isCelebrationSceneSupported({
        ...scene(),
        requiredCapabilities: scene().requiredCapabilities.filter(
          (name) => name !== CelebrationCapability.ViewportStageV1,
        ),
      }),
    ).toBe(false);
  });

  it('maps private native data and binds actor and copy independently', () => {
    const original = historyLadderFixture(HistoryLadderAnchor.Row4);
    const saved = structuredClone(original);
    const prepared = prepare(original);
    expect(prepared.isViewportMapped).toBe(true);
    expect(prepared.companion?.kind).toBe(PackSceneCompanionKind.HistoryLadder);
    const mapped = prepared.data as LottieComposition;
    expect([mapped.w, mapped.h]).toEqual([1280, 900]);
    expect(mapped.layers.some(({ nm }) => nm?.startsWith('hl-anchor:'))).toBe(
      false,
    );
    const actor = mapped.layers.find(({ nm }) => nm === 'hl-track:actor');
    const copy = mapped.layers.find(({ nm }) => nm === 'hl-track:copy');
    expect((actor?.ks?.p?.k as { s: number[] }[])[0].s).toEqual([300, 120, 0]);
    expect((copy?.ks?.p?.k as { s: number[] }[])[1].s).toEqual([300, 280, 0]);
    expect(original).toEqual(saved);
    mapped.layers[0].nm = 'player mutation';
    expect(original).toEqual(saved);
  });

  it.each(['ltr', 'rtl'] as const)(
    'binds the start edge and real viewport edges in %s without mirroring copied text',
    (direction) => {
      const left = direction === 'ltr' ? 96 : 980;
      const pivot = direction === 'ltr' ? left : left + 204;
      vi.mocked(history.getBoundingClientRect).mockReturnValue(
        new DOMRect(left, 100, 204, 500),
      );
      rows.forEach((row, index) =>
        vi
          .mocked(row.getBoundingClientRect)
          .mockReturnValue(new DOMRect(left, 120 + index * 40, 204, 32)),
      );
      const source = historyViewportFixture();
      const original = structuredClone(source);
      const prepared = prepare(source, direction);
      const composition = prepared.data as LottieComposition;
      const positions = (name: string) =>
        composition.layers.find(({ nm }) => nm === name)?.ks?.p?.k as {
          s: number[];
        }[];
      expect(positions('hl-track:actor')[0].s).toEqual([pivot, 120, 0]);
      expect(positions('hl-track:flight').map(({ s }) => s)).toEqual([
        [direction === 'ltr' ? -100 : 1380, 320, 0],
        [pivot, 320, 0],
        [direction === 'ltr' ? 1380 : -100, 320, 0],
        [direction === 'ltr' ? 1380 : -100, 320, 0],
      ]);
      const { host } = install(prepared);
      const copy = host.querySelector<HTMLElement>(
        '[data-celebration-snapshot]',
      );
      expect(copy?.style.transformOrigin).toBe(
        direction === 'ltr' ? '0% 0%' : '100% 0%',
      );
      expect(copy?.textContent).toBe('Conversation 2');
      expect(source).toEqual(original);
    },
  );

  it('creates one inert upright snapshot only after readiness and shares the native clock', () => {
    const prepared = prepare();
    expect(document.querySelector('[data-celebration-snapshot]')).toBeNull();
    const context = install(prepared);
    const copy = context.host.querySelector<HTMLElement>(
      '[data-celebration-snapshot]',
    );
    expect(copy?.inert).toBe(true);
    expect(copy?.getAttribute('aria-hidden')).toBe('true');
    expect(copy?.querySelector('a')?.hasAttribute('href')).toBe(false);
    expect(copy?.style.transformOrigin).toBe('100% 0%');
    expect(animations).toHaveLength(0);
    onHistoryLadderPlaybackStarted({ ...context, timelineZeroMs: 123 });
    expect(animations).toHaveLength(2);
    expect(
      animations.every(({ animation }) => animation.startTime === 123),
    ).toBe(true);
    expect(animations.filter(({ target }) => target === rows[2])).toHaveLength(
      1,
    );
    expect(history.children).toHaveLength(6);
    expect(composer.querySelector('textarea')?.value).toBe('Untouched draft');
    dispose();
    expect(
      context.host.querySelector('[data-celebration-snapshot]'),
    ).toBeNull();
    expect(
      animations.every(
        ({ animation }) => vi.mocked(animation.cancel).mock.calls.length === 1,
      ),
    ).toBe(true);
  });

  it('mirrors native art and rotation while preserving copied text in RTL', () => {
    rows.forEach((row, index) =>
      vi
        .mocked(row.getBoundingClientRect)
        .mockReturnValue(new DOMRect(900, 120 + index * 40, 268, 32)),
    );
    const prepared = prepare(historyLadderFixture(), 'rtl');
    const mapped = prepared.data as LottieComposition;
    expect(
      mapped.layers.find(({ nm }) => nm === 'hl-track:actor')?.ks?.s?.k,
    ).toEqual([-100, 100, 100]);
    const context = install(prepared);
    const copy = context.host.querySelector<HTMLElement>(
      '[data-celebration-snapshot]',
    );
    expect(copy?.style.transformOrigin).toBe('0% 0%');
    onHistoryLadderPlaybackStarted({ ...context, timelineZeroMs: 0 });
    expect(
      animations[0].frames.some(({ transform }) =>
        String(transform).includes('rotate(-12deg)'),
      ),
    ).toBe(true);
    expect(
      animations[0].frames.every(
        ({ transform }) => !String(transform).includes('scale'),
      ),
    ).toBe(true);
    expect(copy?.textContent).toBe(rows[2].textContent);
  });

  it('uses the complete drawn branch without history and creates no snapshot', () => {
    history.remove();
    const prepared = prepare();
    if (prepared.companion?.kind !== PackSceneCompanionKind.HistoryLadder)
      throw new Error('Missing history preparation');
    expect(prepared.companion.mode).toBe(HistoryLadderMode.Drawn);
    expect(prepared.companion.copy).toBeUndefined();
    const context = install(prepared);
    onHistoryLadderPlaybackStarted({ ...context, timelineZeroMs: 0 });
    expect(animations).toHaveLength(0);
    document.dispatchEvent(new Event('keydown'));
    expect(context.cancel).toHaveBeenCalled();
  });

  it.each([
    'pointerdown',
    'focusin',
    'keydown',
    'input',
    'scroll',
    'visibilitychange',
  ])('restores all copies on %s', (event) => {
    const context = install(prepare());
    onHistoryLadderPlaybackStarted({ ...context, timelineZeroMs: 0 });
    document.dispatchEvent(new Event(event));
    expect(context.cancel).toHaveBeenCalled();
    expect(
      context.host.querySelector('[data-celebration-snapshot]'),
    ).toBeNull();
    expect(
      animations.every(
        ({ animation }) => vi.mocked(animation.cancel).mock.calls.length === 1,
      ),
    ).toBe(true);
    expect(history.children[2]).toBe(rows[2]);
    expect(rows[2].getAttribute('style')).toBeNull();
  });

  it('cancels on a moved station or changed row content without remapping', async () => {
    const context = install(prepare());
    onHistoryLadderPlaybackStarted({ ...context, timelineZeroMs: 0 });
    vi.mocked(rows[4].getBoundingClientRect).mockReturnValue(
      new DOMRect(32, 281, 268, 32),
    );
    notifyResize();
    expect(context.cancel).toHaveBeenCalled();
    const second = install(prepare());
    const link = rows[1].firstElementChild;
    if (!link) throw new Error('Expected a conversation link');
    link.textContent = 'Updated conversation';
    await Promise.resolve();
    expect(second.cancel).toHaveBeenCalled();
  });

  it('rejects malformed source data before reading host geometry or cloning', () => {
    const source = historyLadderFixture();
    source.layers.push({ ...source.layers[0] });
    expect(() => prepare(source)).toThrow();
    expect(
      rows.every(
        (row) => vi.mocked(row.getBoundingClientRect).mock.calls.length === 0,
      ),
    ).toBe(true);
    expect(animations).toHaveLength(0);
    expect(document.querySelector('[data-celebration-snapshot]')).toBeNull();
  });
});
