/* Inert scene artwork has no accessible controls; inspect its player boundary. */
/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import { act, render } from '@testing-library/react';
import type { AnimationConfigWithData, AnimationItem } from 'lottie-web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CelebrationAssetLoaders,
  CelebrationSceneDescriptor,
  CelebrationVariantContext,
} from '../../../models/celebration-pack';
import {
  lottieFixture,
  packSceneFixture,
} from '../../../test-utils/pack-fixtures';
import {
  CelebrationCapability,
  CelebrationColorScheme,
  CelebrationLayout,
  CelebrationStageAlign,
} from '../../../types/celebration-pack';
import { loadLottiePlayer } from '../../../utils/lottie-player';
import { LottieScene } from '../LottieScene';

const state = vi.hoisted(() => ({ mobile: false, reduced: false }));
vi.mock('../../../context/CelebrationEnvironmentContext', async () => {
  const { testEnvironment } = await import('../../../test-utils/environment');
  return {
    useCelebrationEnvironment: () =>
      testEnvironment({ isMobile: state.mobile }),
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
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      for (let i = 0; i < extraElements; i++)
        svg.append(document.createElementNS('http://www.w3.org/2000/svg', 'g'));
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

describe('LottieScene', () => {
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
        ...packSceneFixture().placement,
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
        ...packSceneFixture().placement,
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
        requiredCapabilities: [CelebrationCapability.ComposerAnchorV1],
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
});
