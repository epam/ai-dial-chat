import { describe, expect, it } from 'vitest';
import {
  HalloweenDecorBehavior,
  HalloweenScene,
} from '../../halloween/types/halloween';
import { NewYearScene } from '../../new-year/components/NewYear/types';

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

  it('has a story for every event decor', () => {
    expect(covered('celebrationDecor')).toEqual(
      new Set(['halloween', 'new-year']),
    );
  });
});
