import { useMemo, useState } from 'react';

import { groupMarketplaceEntityAndSaveOrder } from '@/src/utils/app/marketplace';
import {
  doesMarketplaceEntityMatchFilters,
  isInstalledEntity,
} from '@/src/utils/marketplace';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { DialAIEntityModel } from '@/src/types/models';

import { useAppSelector } from '@/src/store/hooks';
import {
  ApplicationTypesSchemasSelectors,
  MarketplaceSelectors,
} from '@/src/store/selectors';

import {
  FilterTypes,
  MarketplaceEntitiesTabs,
  MarketplaceTabs,
  ViewTypes,
} from '@/src/constants/marketplace';
import {
  MODELS_SEARCH_OPTIONS,
  TOOLSETS_SEARCH_OPTIONS,
} from '@/src/constants/search';

import { useFuseSearch } from './useFuseSearch';

import { IFuseOptions } from 'fuse.js';
import uniqBy from 'lodash-es/uniqBy';

export const useMarketplaceDisplayedEntities = <T extends MarketplaceEntity>(
  allEntities: T[],
  installedEntitiesIds: Set<string>,
) => {
  const searchTerm = useAppSelector(
    MarketplaceSelectors.selectTrimmedSearchTerm,
  );
  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);
  const selectedEntitiesTab = useAppSelector(
    MarketplaceSelectors.selectSelectedEntitiesTab,
  );
  const selectedFilters = useAppSelector(
    MarketplaceSelectors.selectSelectedFilters,
  );
  const applicationTypeSchemas = useAppSelector(
    ApplicationTypesSchemasSelectors.selectAllSchemas,
  );
  const selectedViewType = useAppSelector(
    MarketplaceSelectors.selectSelectedViewType,
  );

  const [suggestedResults, setSuggestedResults] = useState<T[]>([]);

  const isSelectedAgentsTab =
    selectedEntitiesTab === MarketplaceEntitiesTabs.AGENTS;

  const searchedEntities = useFuseSearch<T>(
    allEntities,
    searchTerm,
    (isSelectedAgentsTab
      ? MODELS_SEARCH_OPTIONS
      : TOOLSETS_SEARCH_OPTIONS) as IFuseOptions<T>,
  );

  const isSomeAgentsFilterNotEmpty =
    searchTerm.length ||
    selectedFilters[FilterTypes.ENTITY_TYPE].length ||
    selectedFilters[FilterTypes.TOPICS].length ||
    selectedFilters[FilterTypes.SOURCES].length;
  const isSomeToolsetsFilterNotEmpty =
    searchTerm.length || selectedFilters[FilterTypes.TOPICS].length;
  const isSomeFilterNotEmpty = isSelectedAgentsTab
    ? isSomeAgentsFilterNotEmpty
    : isSomeToolsetsFilterNotEmpty;

  const displayedEntities = useMemo(() => {
    const filters = isSelectedAgentsTab
      ? selectedFilters
      : { [FilterTypes.TOPICS]: selectedFilters[FilterTypes.TOPICS] };

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

    if (isSelectedAgentsTab) {
      entitiesToDisplay = groupMarketplaceEntityAndSaveOrder(
        entitiesToDisplay as DialAIEntityModel[],
      ).map(({ entities }) => entities[0]) as T[];
    }

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
    isSelectedAgentsTab,
    selectedFilters,
    applicationTypeSchemas,
    installedEntitiesIds,
  ]);

  return {
    displayedEntities,
    suggestedResults,
  };
};
