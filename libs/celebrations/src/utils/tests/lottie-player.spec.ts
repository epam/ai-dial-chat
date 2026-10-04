import { createRequire } from 'node:module';
import type { AnimationConfigWithData, AnimationItem } from 'lottie-web';
import { describe, expect, it, vi } from 'vitest';
import {
  createLottieLightSvgAnimation,
  LOTTIE_LIGHT_SVG_V1_PLAYER_VERSION,
} from '../lottie-player';

const require = createRequire(import.meta.url);

const fakePlayer = (
  setSubframe: (value: boolean) => void = () => undefined,
) => {
  const calls: string[] = [];
  const animation = {
    setSubframe: vi.fn((value: boolean) => {
      calls.push(`setSubframe(${value})`);
      setSubframe(value);
    }),
    destroy: vi.fn(),
  };
  const player = {
    loadAnimation: vi.fn((options: AnimationConfigWithData<'svg'>) => {
      calls.push('loadAnimation');
      options.container?.append(
        document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
      );
      return animation as unknown as AnimationItem;
    }),
  };
  return { player, animation, calls };
};

describe('lottie-light-svg-v1 player profile', () => {
  it('the installed player matches the pinned profile', () => {
    const installed = require('lottie-web/package.json') as {
      version: string;
    };
    const manifest = require('../../../package.json') as {
      dependencies: Record<string, string>;
    };
    expect(installed.version).toBe(LOTTIE_LIGHT_SVG_V1_PLAYER_VERSION);
    expect(manifest.dependencies['lottie-web']).toBe(
      LOTTIE_LIGHT_SVG_V1_PLAYER_VERSION,
    );
  });

  it('creates the renderer with the lottie-light-svg-v1 options', () => {
    const { player, animation, calls } = fakePlayer();
    const container = document.createElement('div');
    const animationData = { v: '5.13.0' };
    expect(
      createLottieLightSvgAnimation(player, container, animationData),
    ).toBe(animation);
    expect(player.loadAnimation).toHaveBeenCalledWith({
      container,
      renderer: 'svg',
      loop: false,
      autoplay: false,
      animationData,
      rendererSettings: {
        progressiveLoad: false,
        preserveAspectRatio: 'xMidYMid meet',
        focusable: false,
      },
    });
    expect(calls).toEqual(['loadAnimation', 'setSubframe(true)']);
  });

  it('releases a renderer it cannot configure and rethrows', () => {
    const { player, animation } = fakePlayer(() => {
      throw new Error('Subframe unavailable');
    });
    animation.destroy.mockImplementation(() => {
      throw new Error('Teardown failed');
    });
    const container = document.createElement('div');
    expect(() => createLottieLightSvgAnimation(player, container, {})).toThrow(
      'Subframe unavailable',
    );
    expect(animation.destroy).toHaveBeenCalledOnce();
    expect(container.childElementCount).toBe(0);
  });
});
