/* Inert scene artwork has no accessible controls; inspect its player boundary. */
/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import { act, fireEvent, render } from '@testing-library/react';
import type { AnimationConfigWithData, AnimationItem } from 'lottie-web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CelebrationAssetLoaders,
  CelebrationComposerAnchorPlacement,
  CelebrationSceneDescriptor,
  CelebrationVariantContext,
} from '../../../models/celebration-pack';
import type { LottieComposition } from '../../../models/lottie-composition';
import {
  lottieFixture,
  packSceneFixture,
} from '../../../test-utils/pack-fixtures';
import {
  CelebrationAnchor,
  CelebrationAnchorEdge,
  CelebrationAnchorFallback,
  CelebrationCapability,
  CelebrationColorScheme,
  CelebrationLayout,
  CelebrationPlacementTemplate,
  CelebrationStageAlign,
  CelebrationStageFit,
} from '../../../types/celebration-pack';
import { loadLottiePlayer } from '../../../utils/lottie-player';
import outlineFixture from '../../../utils/tests/fixtures/composer-outline.lottie.json';
import { LottieScene } from '../LottieScene';

const state = vi.hoisted(() => ({ mobile: false, reduced: false }));
vi.mock('../../../context/CelebrationEnvironmentContext', async () => {
  const { testAnchors, testEnvironment } =
    await import('../../../test-utils/environment');
  return {
    useCelebrationEnvironment: () =>
      testEnvironment({
        isMobile: state.mobile,
        anchors: testAnchors({ composer: 'test-composer' }),
      }),
  };
});
vi.mock('../../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => state.reduced,
}));
vi.mock('../../../utils/lottie-player', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/lottie-player')>()),
  loadLottiePlayer: vi.fn(),
}));

interface FakeAnimation {
  data: object;
  destroy: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  callbacks: Map<string, () => void>;
  emit: (name: string) => void;
}

const LTR: CelebrationVariantContext = {
  direction: 'ltr',
  colorScheme: CelebrationColorScheme.Light,
};
const animations: FakeAnimation[] = [];
let extraElements: number;
let source: ReturnType<typeof lottieFixture>;
const player = {
  loadAnimation:
    vi.fn<(options: AnimationConfigWithData<'svg'>) => AnimationItem>(),
};

const loaders = (
  overrides: Partial<CelebrationAssetLoaders> = {},
): CelebrationAssetLoaders => ({
  loadAnimationData: vi.fn(async () => source),
  resolveImageUrl: vi.fn((id: string) => `/assets/${id}`),
  ...overrides,
});

const deferredData = () => {
  const signals: AbortSignal[] = [];
  let resolve: (value: unknown) => void = () => undefined;
  const loadAnimationData = vi.fn(
    (_id: string, signal: AbortSignal) =>
      new Promise<unknown>((complete) => {
        signals.push(signal);
        resolve = complete;
      }),
  );
  return {
    loadAnimationData,
    signals,
    resolve: (value: unknown) => resolve(value),
  };
};

const renderScene = (
  scene: CelebrationSceneDescriptor = packSceneFixture(),
  sceneLoaders: CelebrationAssetLoaders = loaders(),
  context: CelebrationVariantContext = LTR,
) =>
  render(
    <LottieScene scene={scene} loaders={sceneLoaders} context={context} />,
  );

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
};

const poster = (container: HTMLElement) => container.querySelector('img');

describe('LottieScene', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    state.mobile = false;
    state.reduced = false;
    animations.length = 0;
    extraElements = 0;
    source = lottieFixture();
    player.loadAnimation
      .mockReset()
      .mockImplementation(({ container, animationData }) => {
        const callbacks = new Map<string, () => void>();
        const svg = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'svg',
        );
        for (let i = 0; i < extraElements; i++)
          svg.append(
            document.createElementNS('http://www.w3.org/2000/svg', 'g'),
          );
        container?.append(svg);
        const animation: FakeAnimation = {
          data: animationData as object,
          destroy: vi.fn(() => svg.remove()),
          play: vi.fn(),
          callbacks,
          emit: (name) => callbacks.get(name)?.(),
        };
        animations.push(animation);
        return {
          isLoaded: true,
          currentFrame: 0,
          frameRate: 60,
          setSubframe: vi.fn(),
          play: animation.play,
          destroy: animation.destroy,
          addEventListener: (name: string, callback: () => void) =>
            callbacks.set(name, callback),
          removeEventListener: (name: string) => callbacks.delete(name),
        } as unknown as AnimationItem;
      });
    vi.mocked(loadLottiePlayer).mockReset().mockResolvedValue(player);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it('loads the desktop variant after mount and plays a clone of its data', async () => {
    const sceneLoaders = loaders();
    const { container } = renderScene(packSceneFixture(), sceneLoaders);
    expect(sceneLoaders.loadAnimationData).not.toHaveBeenCalled();
    await flush();
    expect(sceneLoaders.loadAnimationData).toHaveBeenCalledWith(
      'snowman-desktop',
      expect.any(AbortSignal),
    );
    expect(animations).toHaveLength(1);
    expect(animations[0].data).not.toBe(source);
    expect(animations[0].data).toEqual(source);
    const stage = container.querySelector('svg')?.parentElement;
    expect(stage?.className).toMatch(/stage/);
    expect(stage?.style.getPropertyValue('--celebrations-stage-ratio')).toBe(
      '1.6',
    );
    animations[0].emit('DOMLoaded');
    expect(animations[0].play).toHaveBeenCalledOnce();
    expect(poster(container)).toBeNull();
  });

  it('chooses the mobile variant in the mobile layout', async () => {
    state.mobile = true;
    const sceneLoaders = loaders();
    renderScene(packSceneFixture(), sceneLoaders);
    await flush();
    expect(sceneLoaders.loadAnimationData).toHaveBeenCalledWith(
      'snowman-mobile',
      expect.any(AbortSignal),
    );
  });

  it('shows only the poster under reduced motion, for its duration', async () => {
    state.reduced = true;
    const sceneLoaders = loaders();
    const { container } = renderScene(packSceneFixture(), sceneLoaders);
    await flush();
    const image = poster(container);
    expect(image?.getAttribute('src')).toBe('/assets/snowman-poster');
    expect(image?.getAttribute('alt')).toBe('');
    expect(container.firstElementChild?.hasAttribute('inert')).toBe(true);
    expect(sceneLoaders.loadAnimationData).not.toHaveBeenCalled();
    expect(loadLottiePlayer).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(3999));
    expect(poster(container)).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(poster(container)).toBeNull();
  });

  it('aborts the data request on cancellation and ignores its late result', async () => {
    const data = deferredData();
    const { unmount } = renderScene(
      packSceneFixture(),
      loaders({ loadAnimationData: data.loadAnimationData }),
    );
    await flush();
    expect(data.signals[0].aborted).toBe(false);
    unmount();
    expect(data.signals[0].aborted).toBe(true);
    data.resolve(source);
    await flush();
    expect(player.loadAnimation).not.toHaveBeenCalled();
  });

  it('shows the poster when the data misses the load deadline', async () => {
    const data = deferredData();
    const { container } = renderScene(
      packSceneFixture(),
      loaders({ loadAnimationData: data.loadAnimationData }),
    );
    await flush();
    expect(poster(container)).toBeNull();
    act(() => vi.advanceTimersByTime(2000));
    expect(poster(container)?.getAttribute('src')).toBe(
      '/assets/snowman-poster',
    );
    expect(data.signals[0].aborted).toBe(true);
  });

  it('shows the poster when the data has no stage size', async () => {
    source = { ...lottieFixture(), w: 0 };
    const { container } = renderScene();
    await flush();
    expect(poster(container)).toBeTruthy();
    expect(player.loadAnimation).not.toHaveBeenCalled();
  });

  it('renders nothing when the poster URL is unavailable after a failure', async () => {
    const { container } = renderScene(
      packSceneFixture(),
      loaders({
        loadAnimationData: vi.fn(async () => {
          throw new Error('unavailable');
        }),
        resolveImageUrl: () => undefined,
      }),
    );
    await flush();
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing and releases the player once when data fails after the first frame', async () => {
    const { container } = renderScene();
    await flush();
    animations[0].emit('DOMLoaded');
    animations[0].emit('enterFrame');
    animations[0].emit('data_failed');
    await flush();
    expect(container.innerHTML).toBe('');
    expect(animations[0].destroy).toHaveBeenCalledOnce();
    expect(animations[0].callbacks.size).toBe(0);
  });

  it('shows the poster when the renderer exceeds the element budget', async () => {
    extraElements = 800;
    const { container } = renderScene();
    await flush();
    animations[0].emit('DOMLoaded');
    await flush();
    expect(animations[0].play).not.toHaveBeenCalled();
    expect(animations[0].destroy).toHaveBeenCalledOnce();
    expect(poster(container)).toBeTruthy();
  });

  it('mirrors the stage in RTL and anchors bottom-start to the inline start', async () => {
    const scene = packSceneFixture({
      placement: {
        template: CelebrationPlacementTemplate.ViewportStageV1,
        fit: CelebrationStageFit.Contain,
        align: CelebrationStageAlign.BottomStart,
      },
    });
    const { container } = renderScene(scene, loaders(), {
      ...LTR,
      direction: 'rtl',
    });
    await flush();
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('dir')).toBe('rtl');
    expect(root.className).toMatch(/blockEnd/);
    expect(root.className).toMatch(/inlineStart/);
    expect(root.firstElementChild?.className).toMatch(/mirrored/);
  });

  it('takes the poster position from the supplied direction, not the document', async () => {
    state.reduced = true;
    document.documentElement.dir = 'ltr';
    const scene = packSceneFixture({
      placement: {
        template: CelebrationPlacementTemplate.ViewportStageV1,
        fit: CelebrationStageFit.Contain,
        align: CelebrationStageAlign.BottomStart,
      },
    });
    const { container } = renderScene(scene, loaders(), {
      ...LTR,
      direction: 'rtl',
    });
    await flush();
    /* Mirrored in RTL: the flipped image's left edge lands on the right. */
    expect(poster(container)?.style.objectPosition).toBe('left bottom');
    expect(poster(container)?.className).toMatch(/mirrored/);
    document.documentElement.removeAttribute('dir');
  });

  it('does not mirror a scene with direction none', async () => {
    const { container } = renderScene(
      packSceneFixture({ direction: 'none' as never }),
      loaders(),
      { ...LTR, direction: 'rtl' },
    );
    await flush();
    expect(
      (container.firstElementChild as HTMLElement).firstElementChild?.className,
    ).not.toMatch(/mirrored/);
  });

  it.each([
    [
      'no variant matches',
      packSceneFixture({
        variants: [
          {
            when: { layout: CelebrationLayout.Mobile },
            animationAssetId: 'snowman-mobile',
          },
        ],
      }),
    ],
    [
      'a capability is unsupported',
      packSceneFixture({
        requiredCapabilities: ['interaction-cat-borrow-v1'],
      }),
    ],
    [
      'the outline adapter is required without an anchored placement',
      packSceneFixture({
        requiredCapabilities: [
          CelebrationCapability.LottieLightSvgV1,
          CelebrationCapability.InteractionComposerOutlineV1,
        ],
      }),
    ],
  ])('shows the poster without loading anything when %s', async (_, scene) => {
    const sceneLoaders = loaders();
    const { container } = renderScene(scene, sceneLoaders);
    await flush();
    expect(poster(container)).toBeTruthy();
    expect(sceneLoaders.loadAnimationData).not.toHaveBeenCalled();
    expect(loadLottiePlayer).not.toHaveBeenCalled();
  });

  it('ends the scene when the layout changes during playback', async () => {
    const { container, rerender } = renderScene();
    await flush();
    animations[0].emit('DOMLoaded');
    state.mobile = true;
    rerender(
      <LottieScene
        scene={packSceneFixture()}
        loaders={loaders()}
        context={LTR}
      />,
    );
    await flush();
    expect(container.innerHTML).toBe('');
    expect(animations[0].destroy).toHaveBeenCalledOnce();
  });
  describe('LottieScene — composer anchoring', () => {
    let composer: HTMLDivElement;
    let composerRect: DOMRect;
    let viewportWidth: number;

    const anchoredScene = () =>
      packSceneFixture({
        id: 'gift-wrapping',
        requiredCapabilities: [
          CelebrationCapability.LottieLightSvgV1,
          CelebrationCapability.ComposerAnchorV1,
          CelebrationCapability.InteractionComposerOutlineV1,
          CelebrationCapability.StaticPosterV1,
        ],
        placement: {
          template: CelebrationPlacementTemplate.ComposerAnchorV1,
          anchor: CelebrationAnchor.Composer,
          anchorRect: { x: 340, y: 164, width: 520, height: 56 },
          edge: CelebrationAnchorEdge.Top,
          scale: { min: 0.65, max: 1 },
          fallback: CelebrationAnchorFallback.StageAnchor,
        },
      });

    const anchorLayer = (data: object) =>
      (data as LottieComposition).layers.find(
        ({ nm }) => nm === 'composer-anchor',
      );

    const outlinePoints = (data: object) => {
      const layer = (data as LottieComposition).layers.find(
        ({ nm }) => nm === 'composer-outline',
      );
      const group = layer?.shapes?.[0];
      const path = group?.it?.find(({ ty }) => ty === 'sh');
      return (path?.ks?.k as { v: number[][] }).v;
    };

    const anchorHost = (container: HTMLElement) =>
      container.querySelector('[data-celebration-anchor]');

    beforeEach(() => {
      source = JSON.parse(JSON.stringify(outlineFixture));
      viewportWidth = 1280;
      composerRect = new DOMRect(190, 700, 900, 72);
      composer = document.createElement('div');
      composer.className = 'test-composer';
      composer.innerHTML = '<textarea aria-label="Message">Draft</textarea>';
      document.body.append(composer);
      vi.spyOn(composer, 'getBoundingClientRect').mockImplementation(
        () => composerRect,
      );
      vi.spyOn(
        document.documentElement,
        'clientWidth',
        'get',
      ).mockImplementation(() => viewportWidth);
      vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
        900,
      );
      const original = window.getComputedStyle;
      vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
        const style = original(element);
        return {
          ...style,
          visibility: style.visibility || 'visible',
          direction: style.direction || 'ltr',
        } as CSSStyleDeclaration;
      });
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe = vi.fn();
          disconnect = vi.fn();
        },
      );
    });

    afterEach(() => {
      composer.remove();
      vi.unstubAllGlobals();
    });

    it('plays around the measured composer from a viewport-sized copy', async () => {
      const { container } = renderScene(anchoredScene());
      await flush();
      expect(
        anchorHost(container)?.getAttribute('data-celebration-anchor'),
      ).toBe('composer');
      const data = animations[0].data as LottieComposition;
      expect([data.w, data.h]).toEqual([1280, 900]);
      expect(anchorLayer(data)?.ks).toMatchObject({
        a: { k: [600, 164, 0] },
        p: { k: [640, 700, 0] },
        s: { k: [100, 100, 100] },
      });
      const xs = outlinePoints(data).map(([x]) => x);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(894);
      expect(data.layers.some(({ nm }) => nm === 'composer-parcel')).toBe(
        false,
      );
    });

    it('positions the stage once and keeps the draft, focus and selection', async () => {
      const input = composer.querySelector('textarea');
      if (!input) throw new Error('Missing draft');
      input.focus();
      input.setSelectionRange(1, 3);
      const before = composer.outerHTML;
      renderScene(anchoredScene());
      await flush();
      const reads = vi.mocked(composer.getBoundingClientRect).mock.calls.length;
      animations[0].emit('DOMLoaded');
      await act(async () => {
        vi.advanceTimersByTime(8000);
      });
      expect(vi.mocked(composer.getBoundingClientRect).mock.calls.length).toBe(
        reads,
      );
      expect(document.activeElement).toBe(input);
      expect([input.selectionStart, input.selectionEnd]).toEqual([1, 3]);
      expect(composer.outerHTML).toBe(before);
    });

    it('plays around the synthetic anchor when the composer is missing', async () => {
      composer.remove();
      const { container } = renderScene(anchoredScene());
      await flush();
      expect(
        anchorHost(container)?.getAttribute('data-celebration-anchor'),
      ).toBe('stage-anchor');
      expect(
        (animations[0].data as LottieComposition).layers.some(
          ({ nm }) => nm === 'composer-parcel',
        ),
      ).toBe(true);
    });

    it('shows the poster without importing the player when observers are missing', async () => {
      vi.stubGlobal('ResizeObserver', undefined);
      const sceneLoaders = loaders();
      const { container } = renderScene(anchoredScene(), sceneLoaders);
      await flush();
      expect(poster(container)).toBeTruthy();
      expect(loadLottiePlayer).not.toHaveBeenCalled();
      expect(sceneLoaders.loadAnimationData).not.toHaveBeenCalled();
    });

    it('removes the scene and releases the player once when the user types', async () => {
      const { container } = renderScene(anchoredScene());
      await flush();
      animations[0].emit('DOMLoaded');
      fireEvent.keyDown(window, { key: 'a' });
      await flush();
      expect(anchorHost(container)).toBeNull();
      expect(poster(container)).toBeNull();
      expect(animations[0].destroy).toHaveBeenCalledOnce();
    });

    it('keeps playing when the renderer changes its own SVG', async () => {
      const { container } = renderScene(anchoredScene());
      await flush();
      animations[0].emit('DOMLoaded');
      const host = anchorHost(container);
      await act(async () => {
        host?.querySelector('svg')?.setAttribute('class', 'frame-2');
        host
          ?.querySelector('svg')
          ?.append(
            document.createElementNS('http://www.w3.org/2000/svg', 'path'),
          );
        await Promise.resolve();
      });
      expect(anchorHost(container)).toBeTruthy();
      expect(animations[0].destroy).not.toHaveBeenCalled();
    });

    it('cancels when the composer content changes', async () => {
      const { container } = renderScene(anchoredScene());
      await flush();
      animations[0].emit('DOMLoaded');
      await act(async () => {
        composer.setAttribute('class', 'test-composer moved');
        await Promise.resolve();
      });
      await flush();
      expect(anchorHost(container)).toBeNull();
      expect(animations[0].destroy).toHaveBeenCalledOnce();
    });

    it('shows the poster when the outline slot is missing', async () => {
      source = lottieFixture();
      const { container } = renderScene(anchoredScene());
      await flush();
      expect(animations).toHaveLength(0);
      expect(poster(container)).toBeTruthy();
    });

    it('never changes cached data and builds a fresh copy for each activation', async () => {
      const cached = JSON.parse(JSON.stringify(outlineFixture));
      const pristine = JSON.stringify(cached);
      const sceneLoaders = loaders({
        loadAnimationData: vi.fn(async () => cached),
      });
      const { unmount } = renderScene(anchoredScene(), sceneLoaders);
      await flush();
      unmount();
      composerRect = new DOMRect(470, 700, 340, 56);
      renderScene(anchoredScene(), sceneLoaders);
      await flush();
      expect(animations).toHaveLength(2);
      expect(animations[1].data).not.toBe(animations[0].data);
      const width = (data: object) => {
        const xs = outlinePoints(data).map(([x]) => x);
        return Math.max(...xs) - Math.min(...xs);
      };
      expect(width(animations[0].data)).toBeCloseTo(894);
      expect(width(animations[1].data)).toBeCloseTo(340 / (340 / 520) - 6);
      expect(JSON.stringify(cached)).toBe(pristine);
    });

    it('measures nothing and creates no renderer for data that arrives after cancellation', async () => {
      const deferred = deferredData();
      const { unmount } = renderScene(
        anchoredScene(),
        loaders({ loadAnimationData: deferred.loadAnimationData }),
      );
      await flush();
      const reads = vi.mocked(composer.getBoundingClientRect).mock.calls.length;
      unmount();
      expect(deferred.signals[0].aborted).toBe(true);
      deferred.resolve(source);
      await flush();
      expect(player.loadAnimation).not.toHaveBeenCalled();
      expect(vi.mocked(composer.getBoundingClientRect).mock.calls.length).toBe(
        reads,
      );
    });

    const mobileAnchoredScene = () => {
      const scene = anchoredScene();
      return packSceneFixture({
        ...scene,
        variants: [
          scene.variants[0],
          {
            ...scene.variants[1],
            placement: {
              ...(scene.placement as CelebrationComposerAnchorPlacement),
              anchorRect: { x: 210, y: 132, width: 300, height: 56 },
              scale: { min: 0.77, max: 1 },
            },
          },
        ],
      });
    };

    it('uses the mobile variant placement, so a tablet composer keeps the authored size', async () => {
      state.mobile = true;
      viewportWidth = 800;
      composerRect = new DOMRect(32, 700, 736, 72);
      const sceneLoaders = loaders();
      renderScene(mobileAnchoredScene(), sceneLoaders);
      await flush();
      expect(sceneLoaders.loadAnimationData).toHaveBeenCalledWith(
        'snowman-mobile',
        expect.any(AbortSignal),
      );
      expect(anchorLayer(animations[0].data)?.ks).toMatchObject({
        a: { k: [360, 132, 0] },
        p: { k: [400, 700, 0] },
        s: { k: [100, 100, 100] },
      });
    });

    it('shows the poster when a variant changes the placement template', async () => {
      const scene = anchoredScene();
      const { container } = renderScene(
        packSceneFixture({
          ...scene,
          variants: [
            {
              ...scene.variants[0],
              placement: {
                template: CelebrationPlacementTemplate.ViewportStageV1,
                fit: CelebrationStageFit.Contain,
                align: CelebrationStageAlign.Bottom,
              },
            },
          ],
        }),
      );
      await flush();
      expect(poster(container)).toBeTruthy();
      expect(loadLottiePlayer).not.toHaveBeenCalled();
    });

    it('mirrors around the anchor center in RTL', async () => {
      composerRect = new DOMRect(250, 700, 900, 72);
      renderScene(anchoredScene(), loaders(), {
        ...LTR,
        direction: 'rtl',
      });
      await flush();
      expect(anchorLayer(animations[0].data)?.ks).toMatchObject({
        a: { k: [600, 164, 0] },
        p: { k: [700, 700, 0] },
        s: { k: [-100, 100, 100] },
      });
    });
  });
});
