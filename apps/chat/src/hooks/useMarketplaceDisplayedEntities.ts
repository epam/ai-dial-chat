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
  SettingsSelectors,
} from '@/src/store/selectors';

import {
  FilterTypes,
  MarketplaceEntitiesTabs,
  MarketplaceTabs,
  ViewTypes,
} from '@/src/constants/marketplace';
import { MARKETPLACE_ENTITIES_SEARCH_OPTIONS } from '@/src/constants/search';

import { useFuseSearch } from './useFuseSearch';

import { Feature } from '@epam/ai-dial-shared';
import uniqBy from 'lodash-es/uniqBy';

export const useMarketplaceDisplayedEntities = <T extends MarketplaceEntity>(
  allEntities: T[],
  installedEntitiesIds: Set<string>,
  selectedFilters: MarketplaceFilters,
  isPersonalEntity?: (entity: T) => boolean,
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
  const defaultRecentModelsIds = useAppSelector(
    SettingsSelectors.selectDefaultRecentModelsIds,
  );
  const selectedEntitiesTab = useAppSelector(
    MarketplaceSelectors.selectSelectedEntitiesTab,
  );
  const isHideMyAppsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.MarketplaceHideMyApps),
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
    !!selectedFilters[FilterTypes.SOURCES].length ||
    !!selectedFilters[FilterTypes.AUTH].length;

  const featuredEntities = useMemo<T[]>(() => {
    if (
      selectedTab === MarketplaceTabs.MY_WORKSPACE ||
      selectedEntitiesTab !== MarketplaceEntitiesTabs.AGENTS ||
      isSomeFilterNotEmpty
    ) {
      return [];
    }

    const shouldHidePersonal = isHideMyAppsEnabled && !!isPersonalEntity;

    return allEntities.filter(
      (e) =>
        defaultRecentModelsIds.includes(e.reference) &&
        (!shouldHidePersonal || (!isPersonalEntity!(e) && !e.sharedWithMe)),
    );
  }, [
    selectedTab,
    selectedEntitiesTab,
    isSomeFilterNotEmpty,
    allEntities,
    defaultRecentModelsIds,
    isHideMyAppsEnabled,
    isPersonalEntity,
  ]);

  const displayedEntities = useMemo(() => {
    const filters = selectedFilters;

    const filteredEntities = searchedEntities.filter((entity) =>
      doesMarketplaceEntityMatchFilters(
        entity,
        filters,
        applicationTypeSchemas,
      ),
    );

    const isMyWorkspace = selectedTab === MarketplaceTabs.MY_WORKSPACE;
    const shouldHidePersonal =
      !isMyWorkspace && isHideMyAppsEnabled && !!isPersonalEntity;

    const entitiesForTab = isMyWorkspace
      ? filteredEntities.filter((entity) =>
          isInstalledEntity(entity, installedEntitiesIds),
        )
      : shouldHidePersonal
        ? filteredEntities.filter(
            (entity) => !isPersonalEntity!(entity) && !entity.sharedWithMe,
          )
        : filteredEntities;

    const shouldSuggest = isMyWorkspace && isSomeFilterNotEmpty;

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
    isHideMyAppsEnabled,
    isPersonalEntity,
  ]);

  return {
    displayedEntities,
    suggestedResults,
    featuredEntities,
  };
};
