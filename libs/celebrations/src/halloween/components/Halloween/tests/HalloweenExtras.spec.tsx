/* Decorative artwork is deliberately absent from the accessibility tree. */
/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HALLOWEEN_LABELS } from '../../../constants/labels';
import { halloweenEvent as halloween } from '../../../event';
import { HalloweenScene } from '../../../types/halloween';
import * as portal from '../../../utils/halloween-portal';
import HalloweenBurstOverlay from '../HalloweenBurstOverlay';

const envState = vi.hoisted(() => ({ mobile: false }));
vi.mock(
  '../../../../context/CelebrationEnvironmentContext',
  async (importOriginal) => {
    const { testAnchors, testEnvironment } =
      await import('../../../../test-utils/environment');
    /* One anchors object for the whole file, as the provider memoizes it. */
    const anchors = testAnchors({});
    return {
      ...(await importOriginal<
        typeof import('../../../../context/CelebrationEnvironmentContext')
      >()),
      useCelebrationEnvironment: () =>
        testEnvironment({ isMobile: envState.mobile, anchors }),
    };
  },
);

const scenes = [
  HalloweenScene.Train,
  HalloweenScene.Portal,
  HalloweenScene.Ravens,
  HalloweenScene.Candy,
  HalloweenScene.Footprints,
  HalloweenScene.Skeletons,
];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('additional Halloween scenes', () => {
  it.each(scenes)(
    'registers %s for random clicks with a secret hint and a finite deadline',
    (id) => {
      const scene = halloween.scenes.find((candidate) => candidate.id === id);
      expect(halloween.clickSceneIds).toContain(id);
      expect(scene?.durationMs).toBeGreaterThanOrEqual(10000);
      expect(scene?.durationMs).toBeLessThanOrEqual(14000);
      const key = scene?.labelId as keyof typeof HALLOWEEN_LABELS;
      expect(HALLOWEEN_LABELS[key]).toContain('{{phrase}}');
      expect(HALLOWEEN_LABELS[key]).toContain('start-page chat');
    },
  );

  it.each(scenes)('renders %s as decorative artwork', (burst) => {
    const { container } = render(<HalloweenBurstOverlay burst={burst} />);
    /* Decorative drawings deliberately have no accessible query. */

    expect(
      container
        .querySelector(`[data-halloween-scene="${burst}"]`)
        ?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it.each([true, false])('bounds particle counts on mobile=%s', (mobile) => {
    envState.mobile = mobile;
    const { container, rerender } = render(
      <HalloweenBurstOverlay burst={HalloweenScene.Candy} />,
    );
    expect(container.querySelectorAll('svg')).toHaveLength(mobile ? 18 : 32);
    rerender(<HalloweenBurstOverlay burst={HalloweenScene.Ravens} />);
    expect(container.querySelectorAll('[data-raven-art]')).toHaveLength(
      mobile ? 5 : 8,
    );
  });
});

describe('portal motion preference and lifecycle', () => {
  const mediaPreference = (initial: boolean) => {
    const events = new EventTarget();
    const media = {
      matches: initial,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    );
    return (matches: boolean) => {
      media.matches = matches;
      act(() => {
        events.dispatchEvent(new Event('change'));
      });
    };
  };

  it('restores borrowed rows when reduced motion is enabled during playback', () => {
    const changePreference = mediaPreference(false);
    const stop = vi.fn();
    const borrow = vi.spyOn(portal, 'animatePortalRows').mockReturnValue(stop);
    render(<HalloweenBurstOverlay burst={HalloweenScene.Portal} />);
    expect(borrow).toHaveBeenCalledOnce();
    changePreference(true);
    expect(stop).toHaveBeenCalledOnce();
    expect(borrow).toHaveBeenCalledOnce();
  });

  it('does not borrow any rows when reduced motion is already enabled', () => {
    mediaPreference(true);
    const borrow = vi.spyOn(portal, 'animatePortalRows');
    render(<HalloweenBurstOverlay burst={HalloweenScene.Portal} />);
    expect(borrow).not.toHaveBeenCalled();
  });

  it('restores rows on scene replacement and unmount', () => {
    mediaPreference(false);
    const stop = vi.fn();
    vi.spyOn(portal, 'animatePortalRows').mockReturnValue(stop);
    const { rerender, unmount } = render(
      <HalloweenBurstOverlay burst={HalloweenScene.Portal} />,
    );
    rerender(<HalloweenBurstOverlay burst={HalloweenScene.Train} />);
    expect(stop).toHaveBeenCalledOnce();
    rerender(<HalloweenBurstOverlay burst={HalloweenScene.Portal} />);
    unmount();
    expect(stop).toHaveBeenCalledTimes(2);
  });
});
