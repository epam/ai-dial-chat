import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveCelebrationPools } from '../../../../utils/celebration';
import { NEW_YEAR_LABELS } from '../../../constants/labels';
import { newYearEvent as newYear } from '../../../event';
import { NewYearScene } from '../../../types/new-year';
import NewYearDecor from '../NewYearDecor';

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
      useCelebrationEnvironment: () => testEnvironment({ anchors }),
    };
  },
);

describe('NewYear', () => {
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

  describe('New Year event contract', () => {
    it('offers the penguin and the snowman on gift clicks and the elves or reindeer for the phrase', () => {
      expect(newYear.scenes.map(({ id }) => id)).toEqual([
        NewYearScene.PenguinStar,
        NewYearScene.GiftWrapping,
        NewYearScene.SnowmanDelivery,
        NewYearScene.ReindeerTakeoff,
      ]);
      expect(newYear.clickSceneIds).toEqual([
        NewYearScene.PenguinStar,
        NewYearScene.SnowmanDelivery,
      ]);
      expect(newYear.secretTrigger?.sceneIds).toEqual([
        NewYearScene.GiftWrapping,
        NewYearScene.ReindeerTakeoff,
      ]);
    });

    it.each([
      [NewYearScene.SnowmanDelivery, [NewYearScene.PenguinStar]],
      [NewYearScene.PenguinStar, [NewYearScene.SnowmanDelivery]],
    ])(
      'keeps the other click scene when the host disables %s',
      (disabled, expected) => {
        const pools = resolveCelebrationPools(newYear, {
          disabledScenes: [disabled],
        });
        expect(pools.clickSceneIds).toEqual(expected);
        expect(pools.secretSceneIds).toEqual([
          NewYearScene.GiftWrapping,
          NewYearScene.ReindeerTakeoff,
        ]);
      },
    );

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

    it.each([NewYearScene.GiftWrapping, NewYearScene.ReindeerTakeoff])(
      'keeps the other secret story when the host disables %s',
      (disabled) => {
        const pools = resolveCelebrationPools(newYear, {
          disabledScenes: [disabled],
        });
        expect(pools.secretSceneIds).toEqual(
          newYear.secretTrigger?.sceneIds.filter((id) => id !== disabled),
        );
        expect(pools.isSecretEnabled).toBe(true);
        expect(pools.clickSceneIds).toEqual(newYear.clickSceneIds);
      },
    );
    it('leaves the phrase to ordinary chat when both secret stories are disabled', () => {
      const pools = resolveCelebrationPools(newYear, {
        disabledScenes: [
          NewYearScene.GiftWrapping,
          NewYearScene.ReindeerTakeoff,
        ],
      });
      expect(pools.isSecretEnabled).toBe(false);
      expect(pools.clickSceneIds).toEqual(newYear.clickSceneIds);
    });
  });
});
