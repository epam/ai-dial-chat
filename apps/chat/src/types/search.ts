import { ShareEntity } from '@epam/ai-dial-shared';

export enum SearchFilters {
  None = 0,
  SharedByMe = 1 << 0,
  PublishedByMe = 1 << 1,
}

export type EntityFilter<T> = (item: T) => boolean;
export type EntityVersionFilter<T> = (item: T, version: string) => boolean;

export interface EntityFilters {
  sectionFilter?: EntityFilter<ShareEntity>; // filter root level folders and items e.g. "Shared with me"
  searchFilter?: EntityFilter<ShareEntity>; // filter specific level folders and items e.g. "Shared by me"
  versionFilter?: EntityVersionFilter<ShareEntity>; // filter items whose versions are selected
}
