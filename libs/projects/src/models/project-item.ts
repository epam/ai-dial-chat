import type { ProjectSource } from '../types/project-source';

/** One project rendered as a card by {@link Projects}. */
export interface ProjectItem {
  /** Stable unique id, used as the list key. */
  id: string;
  /** Display name, matched by search and highlighted. */
  name: string;
  /** Where the project comes from; selects the source badge label. */
  source: ProjectSource;
  /** Last-updated time in epoch milliseconds; the card omits its date line when unset. */
  updatedAt?: number;
}
