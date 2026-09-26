import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import newYear from '../../../celebrations/new-year';
import { useIsMobile } from '../../../hooks/breakpoint/useBreakpoint';
import en from '../../../i18n/locales/en.json';
import NewYearDecor from '../NewYearDecor';
import NewYearParticles from '../NewYearParticles';
import NewYearSleigh from '../NewYearSleigh';
import { buildNewYearParticles } from '../particles';
import { NewYearScene } from '../types';

vi.mock('../../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: vi.fn(),
}));

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
    await user.click(screen.getByRole('button', { name: 'newYear.giftLabel' }));
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
      vi.mocked(useIsMobile).mockReturnValue(mobile);
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
    vi.mocked(useIsMobile).mockReturnValue(mobile);
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
      const key = labelId as keyof typeof en.newYear;
      expect(en.newYear[key]).toContain('{{phrase}}');
    });
  });
});
