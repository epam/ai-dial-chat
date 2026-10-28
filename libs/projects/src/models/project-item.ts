import type { ProjectSource } from '../types/project-source';

/** One project rendered as a card by {@link Projects}. */
export interface ProjectItem {
  /** Stable unique id, used as the list key. */
  id: string;
  /** Display name, matched by search and highlighted. */
  name: string;
  /** Where the project comes from; its label is the first segment of the card's folder path. */
  source: ProjectSource;
  /** `/`-separated grouping folders the project sits in, shown after the source in the folder path. */
  parentPath?: string;
  /** Last-updated time in epoch milliseconds, used by the date sort orders. */
  updatedAt?: number;
  /** Whether the user pinned the project; pinned projects sort first and show a pinned marker. Defaults to `false`. */
  isPinned?: boolean;
}
