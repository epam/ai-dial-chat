import { useMemo, useState } from 'react';

import { groupMarketplaceEntityAndSaveOrder } from '@/src/utils/app/marketplace';
import {
  doesMarketplaceEntityMatchFilters,
  isInstalledEntity,
} from '@/src/utils/marketplace';

import { MarketplaceEntity, MarketplaceFilters } from '@/src/types/marketplace';

import { useAppSelector } from '@/src/store/hooks';
import {
  ApplicationTypesSchemasSelectors,
  MarketplaceSelectors,
} from '@/src/store/selectors';

import {
  FilterTypes,
  MarketplaceTabs,
  ViewTypes,
} from '@/src/constants/marketplace';
import { MARKETPLACE_ENTITIES_SEARCH_OPTIONS } from '@/src/constants/search';

import { useFuseSearch } from './useFuseSearch';

import uniqBy from 'lodash-es/uniqBy';

export const useMarketplaceDisplayedEntities = <T extends MarketplaceEntity>(
  allEntities: T[],
  installedEntitiesIds: Set<string>,
  selectedFilters: MarketplaceFilters,
) => {
  const searchTerm = useAppSelector(
    MarketplaceSelectors.selectTrimmedSearchTerm,
  );
  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);

  const applicationTypeSchemas = useAppSelector(
    ApplicationTypesSchemasSelectors.selectAllSchemas,
  );
  const selectedViewType = useAppSelector(
    MarketplaceSelectors.selectSelectedViewType,
  );

  const [suggestedResults, setSuggestedResults] = useState<T[]>([]);

  const searchedEntities = useFuseSearch<T>(
    allEntities,
    searchTerm,
    MARKETPLACE_ENTITIES_SEARCH_OPTIONS,
  );

  const isSomeFilterNotEmpty =
    !!searchTerm.length ||
    !!selectedFilters[FilterTypes.ENTITY_TYPE].length ||
    !!selectedFilters[FilterTypes.TOPICS].length ||
    !!selectedFilters[FilterTypes.SOURCES].length;

  const displayedEntities = useMemo(() => {
    const filters = selectedFilters;

    const filteredEntities = searchedEntities.filter((entity) =>
      doesMarketplaceEntityMatchFilters(
        entity,
        filters,
        applicationTypeSchemas,
      ),
    );

    const entitiesForTab =
      selectedTab === MarketplaceTabs.MY_WORKSPACE
        ? filteredEntities.filter((entity) =>
            isInstalledEntity(entity, installedEntitiesIds),
          )
        : filteredEntities;

    const shouldSuggest =
      selectedTab === MarketplaceTabs.MY_WORKSPACE && isSomeFilterNotEmpty;

    if (selectedViewType === ViewTypes.TABLE) {
      if (shouldSuggest) {
        const suggestedListWithoutInstalled = filteredEntities.filter(
          (entity) => !isInstalledEntity(entity, installedEntitiesIds),
        );

        setSuggestedResults(suggestedListWithoutInstalled);
      } else {
        setSuggestedResults([]);
      }

      return entitiesForTab;
    }

    let entitiesToDisplay: T[] = uniqBy(
      entitiesForTab.concat(shouldSuggest ? filteredEntities : []),
      (entity) => entity.reference,
    );

    entitiesToDisplay = groupMarketplaceEntityAndSaveOrder(
      entitiesToDisplay,
    ).map(({ entities }) => entities[0]);

    if (shouldSuggest) {
      const suggestedListWithoutInstalled = entitiesToDisplay.filter(
        (entity) => !isInstalledEntity(entity, installedEntitiesIds),
      );
      entitiesToDisplay = entitiesToDisplay.filter((entity) =>
        isInstalledEntity(entity, installedEntitiesIds),
      );
      setSuggestedResults(suggestedListWithoutInstalled);
    } else {
      setSuggestedResults([]);
    }

    return entitiesToDisplay;
  }, [
    searchedEntities,
    selectedTab,
    isSomeFilterNotEmpty,
    selectedViewType,
    selectedFilters,
    applicationTypeSchemas,
    installedEntitiesIds,
  ]);

  return {
    displayedEntities,
    suggestedResults,
  };
};
