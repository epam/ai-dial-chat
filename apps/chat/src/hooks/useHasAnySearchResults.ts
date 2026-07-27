import { useMemo } from 'react';

import {
  PublishedWithMeFilter,
  SharedWithMeFilters,
} from '@/src/utils/app/search';

import { FeatureType } from '@/src/types/common';
import { EntityFilters } from '@/src/types/search';
import { RootState } from '@/src/types/store';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { FolderInterface } from '@epam/ai-dial-shared';

interface FilteredEntitySelectors<T> {
  selectFilteredItems: (
    filters: EntityFilters,
    searchTerm: string,
  ) => (state: RootState) => T[];
  selectFilteredFolders: (
    filters: EntityFilters,
    searchTerm: string,
  ) => (state: RootState) => FolderInterface[];
}

export const useHasAnySearchResults = <T>(
  featureType: FeatureType.Chat | FeatureType.Prompt,
  searchTerm: string,
  hasRootResults: boolean,
  { selectFilteredItems, selectFilteredFolders }: FilteredEntitySelectors<T>,
) => {
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, featureType),
  );
  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.selectIsPublishingEnabled(state, featureType),
  );

  const sharedWithMeItems = useAppSelector(
    useMemo(
      () => selectFilteredItems(SharedWithMeFilters, searchTerm),
      [selectFilteredItems, searchTerm],
    ),
  );
  const sharedWithMeFolders = useAppSelector(
    useMemo(
      () => selectFilteredFolders(SharedWithMeFilters, searchTerm),
      [selectFilteredFolders, searchTerm],
    ),
  );

  const publishedWithMeItems = useAppSelector(
    useMemo(
      () => selectFilteredItems(PublishedWithMeFilter, searchTerm),
      [selectFilteredItems, searchTerm],
    ),
  );
  const publishedWithMeFolders = useAppSelector(
    useMemo(
      () => selectFilteredFolders(PublishedWithMeFilter, searchTerm),
      [selectFilteredFolders, searchTerm],
    ),
  );

  return (
    hasRootResults ||
    (isSharingEnabled &&
      (sharedWithMeItems.length > 0 || sharedWithMeFolders.length > 0)) ||
    (isPublishingEnabled &&
      (publishedWithMeItems.length > 0 || publishedWithMeFolders.length > 0))
  );
};
