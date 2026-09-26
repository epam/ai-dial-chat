import type { CelebrationEvent } from '../types/celebration';

/* Only compiled modules can be loaded; configuration never becomes an import path. */
const events = new Map<string, () => Promise<{ default: CelebrationEvent }>>([
  ['halloween', () => import('./halloween')],
  ['new-year', () => import('./new-year')],
]);

export const loadCelebrationEvent = async (
  id: string,
): Promise<CelebrationEvent | null> => {
  const load = events.get(id);
  return load ? (await load()).default : null;
};
