import { describe, expect, it } from 'vitest';
import {
  HalloweenDecorBehavior,
  HalloweenScene,
} from '../../halloween/types/halloween';
import { NewYearScene } from '../../new-year/types/new-year';

interface StoryModule {
  default?: { title?: string };
  [name: string]: unknown;
}

const modules = import.meta.glob<StoryModule>('../../**/*.stories.tsx', {
  eager: true,
});

/* Every story names what it covers in its parameters. */
const covered = (parameter: string) =>
  new Set(
    Object.values(modules).flatMap((module) =>
      Object.entries(module)
        .filter(([name]) => name !== 'default')
        .map(
          ([, story]) =>
            (story as { parameters?: Record<string, unknown> })?.parameters?.[
              parameter
            ],
        )
        .filter((value): value is string => typeof value === 'string'),
    ),
  );

describe('Storybook coverage', () => {
  it('has a story for every Halloween and New Year scene', () => {
    const scenes = covered('celebrationScene');
    [...Object.values(HalloweenScene), ...Object.values(NewYearScene)].forEach(
      (scene) => expect(scenes, `missing story for ${scene}`).toContain(scene),
    );
  });

  it('has a story for every Halloween decor behavior', () => {
    const behaviors = covered('celebrationBehavior');
    Object.values(HalloweenDecorBehavior).forEach((behavior) =>
      expect(behaviors, `missing story for ${behavior}`).toContain(behavior),
    );
  });

  it.each([HalloweenScene.Footprints, HalloweenScene.Candy])(
    'covers %s with starters above, below and absent',
    (scene) => {
      const variants = Object.values(modules).flatMap((module) =>
        Object.entries(module)
          .filter(([name]) => name !== 'default')
          .map(
            ([, story]) =>
              story as {
                args?: {
                  sceneId?: string;
                  startersBelowComposer?: boolean;
                  showStarters?: boolean;
                };
              },
          )
          .filter(({ args }) => args?.sceneId === scene)
          .map(({ args }) => args),
      );
      const orderings = variants
        .filter((args) => args?.showStarters !== false)
        .map((args) => args?.startersBelowComposer);
      expect(orderings).toContain(true);
      expect(orderings).toContain(false);
      expect(variants.some((args) => args?.showStarters === false)).toBe(true);
    },
  );

  it('has a story for every event decor', () => {
    expect(covered('celebrationDecor')).toEqual(
      new Set(['halloween', 'new-year']),
    );
  });
});
