import type { CelebrationEventLoader } from '@epam/ai-dial-celebrations';

/* Only compiled modules can be loaded; configuration never becomes an import path. */
export const CELEBRATION_EVENTS: Readonly<
  Record<string, CelebrationEventLoader>
> = {
  halloween: () => import('./halloween'),
  'new-year': () => import('./new-year'),
};
