import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NEW_YEAR_LABELS } from '../../../constants/labels';
import { newYearEvent as newYear } from '../../../event';
import NewYearDecor from '../NewYearDecor';
import NewYearParticles from '../NewYearParticles';
import NewYearSleigh from '../NewYearSleigh';
import { buildNewYearParticles } from '../particles';
import { NewYearScene } from '../types';

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

/* Particle and flight layers are intentionally absent from accessible queries. */
const particleElements = () =>
  // eslint-disable-next-line testing-library/no-node-access
  document.querySelectorAll<HTMLElement>('[style*="--particle-x"]');
const flightElements = () =>
  // eslint-disable-next-line testing-library/no-node-access
  document.querySelectorAll<HTMLElement>('[style*="--flight-start-x"]');

const sceneDeadline = (sceneId: NewYearScene): number => {
  const scene = newYear.scenes.find((item) => item.id === sceneId);
  if (!scene) throw new Error(`Missing scene: ${sceneId}`);
  return scene.durationMs;
};

afterEach(() => vi.restoreAllMocks());

describe('NewYearDecor', () => {
  it('activates the supplied behavior with mouse, Enter, and Space', async () => {
    const onActivate = vi.fn();
    render(<NewYearDecor onActivate={onActivate} />);
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    await user.click(screen.getByRole('button', { name: 'New Year gift' }));
    expect(onActivate).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe.each([
  { mobile: true, snow: 28, confetti: 36, sleigh: 2 },
  { mobile: false, snow: 48, confetti: 64, sleigh: 3 },
])('New Year scenes (mobile=$mobile)', ({ mobile, snow, confetti, sleigh }) => {
  it.each([
    [NewYearScene.Snow, snow],
    [NewYearScene.Confetti, confetti],
  ] as const)(
    'scatters %s particles without restarting them on rerender',
    (scene, count) => {
      envState.mobile = mobile;
      const { rerender } = render(<NewYearParticles scene={scene} />);
      expect(particleElements()).toHaveLength(count);
      const initial = Array.from(
        particleElements(),
        (particle) => particle.style.cssText,
      );
      rerender(<NewYearParticles scene={scene} />);
      expect(
        Array.from(particleElements(), (particle) => particle.style.cssText),
      ).toEqual(initial);
    },
  );

  it('gives the sleigh enough time to leave before the scene deadline', () => {
    envState.mobile = mobile;
    render(<NewYearSleigh />);
    expect(flightElements()).toHaveLength(sleigh);
    const deadline = sceneDeadline(NewYearScene.Sleigh);
    flightElements().forEach((flight) => {
      const duration = parseFloat(
        flight.style.getPropertyValue('--flight-duration'),
      );
      const delay = parseFloat(flight.style.getPropertyValue('--flight-delay'));
      expect((duration + delay) * 1000).toBeLessThan(deadline);
    });
  });

  it.each([NewYearScene.Snow, NewYearScene.Confetti] as const)(
    'lets even the slowest %s particles leave before cleanup',
    (sceneId) => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9999);
      const deadline = sceneDeadline(sceneId);
      const particles = buildNewYearParticles(sceneId, mobile) as Record<
        string,
        string
      >[];
      particles.forEach((particle) => {
        const duration = parseFloat(particle['--particle-duration']);
        const delay = parseFloat(particle['--particle-delay']);
        expect((duration + delay) * 1000).toBeLessThan(deadline);
      });
    },
  );
});

describe('New Year event contract', () => {
  it('has a runnable scene for every trigger and a secret hint in every notification', () => {
    const sceneIds = newYear.scenes.map((scene) => scene.id);
    expect(new Set(sceneIds).size).toBe(sceneIds.length);
    newYear.clickSceneIds.forEach((id) => expect(sceneIds).toContain(id));
    newYear.secretTrigger?.sceneIds.forEach((id) =>
      expect(sceneIds).toContain(id),
    );
    newYear.scenes.forEach(({ labelId }) => {
      const key = labelId as keyof typeof NEW_YEAR_LABELS;
      expect(NEW_YEAR_LABELS[key]).toContain('{{phrase}}');
    });
  });
});
