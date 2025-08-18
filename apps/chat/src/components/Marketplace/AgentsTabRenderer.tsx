import { useCallback, useMemo, useState } from 'react';

import { useFuseSearch } from '@/src/hooks/useFuseSearch';

import { groupModelsAndSaveOrder } from '@/src/utils/app/models';
import { doesApplicationMatchFilters } from '@/src/utils/marketplace';

import { DialAIEntityModel } from '@/src/types/models';

import { MarketplaceActions, ModelsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationTypesSchemasSelectors,
  MarketplaceSelectors,
  ModelsSelectors,
} from '@/src/store/selectors';

import {
  DeleteType,
  FilterTypes,
  MarketplaceTabs,
  ViewTypes,
} from '@/src/constants/marketplace';
import { MODELS_SEARCH_OPTIONS } from '@/src/constants/search';

import { AgentDialogs } from '@/src/components//Common/AgentDialogs';

import { ApplicationDetails } from './ApplicationDetails/ApplicationDetails';
import { ResultsView, ResultsViewProps } from './TabResults';

const AgentsResultsView = ResultsView as React.ComponentType<
  ResultsViewProps<DialAIEntityModel>
>;

export const AgentsTabRenderer = () => {
  const dispatch = useAppDispatch();

  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);
  const selectedFilters = useAppSelector(
    MarketplaceSelectors.selectSelectedFilters,
  );
  const searchTerm = useAppSelector(
    MarketplaceSelectors.selectTrimmedSearchTerm,
  );
  const allModels = useAppSelector(ModelsSelectors.selectModels);
  const detailsModel = useAppSelector(MarketplaceSelectors.selectDetailsModel);
  const selectedViewType = useAppSelector(
    MarketplaceSelectors.selectSelectedViewType,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const applicationTypeSchemas = useAppSelector(
    ApplicationTypesSchemasSelectors.selectAllSchemas,
  );

  const [suggestedResults, setSuggestedResults] = useState<DialAIEntityModel[]>(
    [],
  );

  const isSomeFilterNotEmpty =
    searchTerm.length ||
    selectedFilters[FilterTypes.ENTITY_TYPE].length ||
    selectedFilters[FilterTypes.TOPICS].length ||
    selectedFilters[FilterTypes.SOURCES].length;

  const areAllFiltersEmpty =
    !searchTerm.length &&
    !selectedFilters[FilterTypes.ENTITY_TYPE].length &&
    !selectedFilters[FilterTypes.TOPICS].length &&
    !selectedFilters[FilterTypes.SOURCES].length;

  const searchedModels = useFuseSearch(
    allModels,
    searchTerm,
    MODELS_SEARCH_OPTIONS,
  );

  const displayedEntities = useMemo(() => {
    const filteredEntities = searchedModels.filter((entity) =>
      doesApplicationMatchFilters(
        entity,
        selectedFilters,
        applicationTypeSchemas,
      ),
    );

    const isInstalledModel = (entity: DialAIEntityModel) =>
      installedModelIds.has(entity.reference);

    const entitiesForTab =
      selectedTab === MarketplaceTabs.MY_WORKSPACE
        ? filteredEntities.filter(isInstalledModel)
        : filteredEntities;

    const shouldSuggest =
      selectedTab === MarketplaceTabs.MY_WORKSPACE && isSomeFilterNotEmpty;

    if (selectedViewType === ViewTypes.TABLE) {
      if (shouldSuggest) {
        const suggestedListWithoutInstalled = filteredEntities.filter(
          (entity) => !isInstalledModel(entity),
        );

        setSuggestedResults(suggestedListWithoutInstalled);
      } else {
        setSuggestedResults([]);
      }

      return entitiesForTab;
    }

    const groupedEntities = groupModelsAndSaveOrder(
      entitiesForTab.concat(shouldSuggest ? filteredEntities : []),
    );

    let orderedEntities = groupedEntities.map(({ entities }) => entities[0]);

    if (shouldSuggest) {
      const suggestedListWithoutInstalled = orderedEntities.filter(
        (entity) => !isInstalledModel(entity),
      );
      orderedEntities = orderedEntities.filter(isInstalledModel);
      setSuggestedResults(suggestedListWithoutInstalled);
    } else {
      setSuggestedResults([]);
    }

    return orderedEntities;
  }, [
    searchedModels,
    selectedTab,
    selectedViewType,
    isSomeFilterNotEmpty,
    selectedFilters,
    installedModelIds,
    applicationTypeSchemas,
  ]);

  const handleSetDetailsModel = useCallback(
    (model: { reference: string }) => {
      dispatch(
        MarketplaceActions.setDetailsModel({
          reference: model.reference,
          isSuggested: suggestedResults
            .map((item) => item.reference)
            .includes(model.reference),
        }),
      );
    },
    [dispatch, suggestedResults],
  );

  const handleSetVersion = useCallback(
    (model: DialAIEntityModel) => {
      if (detailsModel) {
        dispatch(
          MarketplaceActions.setDetailsModel({
            ...detailsModel,
            reference: model.reference,
          }),
        );
      }
    },
    [detailsModel, dispatch],
  );

  const handleCloseDetailsDialog = useCallback(
    () => dispatch(MarketplaceActions.setDetailsModel()),
    [dispatch],
  );

  const handleBookmarkClick = useCallback(
    (entity: DialAIEntityModel) => {
      if (installedModelIds.has(entity.reference)) {
        dispatch(
          MarketplaceActions.setDeleteModel({
            entity,
            action: DeleteType.REMOVE,
          }),
        );
      } else {
        dispatch(
          ModelsActions.addInstalledModels({
            references: [entity.reference],
            showSuccessToast: true,
          }),
        );
      }
    },
    [dispatch, installedModelIds],
  );

  const currentDetailsModel = detailsModel && modelsMap[detailsModel.reference];

  return (
    <>
      <AgentsResultsView
        entities={displayedEntities}
        suggestedResults={suggestedResults}
        selectedTab={selectedTab}
        areAllFiltersEmpty={areAllFiltersEmpty}
        selectedViewType={selectedViewType}
        onCardClick={handleSetDetailsModel}
        onBookmarkClick={handleBookmarkClick}
      />

      {/* MODALS */}

      {currentDetailsModel && (
        <ApplicationDetails
          entity={currentDetailsModel}
          onChangeVersion={handleSetVersion}
          onClose={handleCloseDetailsDialog}
          onBookmarkClick={handleBookmarkClick}
          allEntities={allModels}
          isMyAppsTab={selectedTab === MarketplaceTabs.MY_WORKSPACE}
          isSuggested={detailsModel.isSuggested}
        />
      )}

      <AgentDialogs />
    </>
  );
};
