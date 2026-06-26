import React, { useCallback } from 'react';

import { useMarketplaceDisplayedEntities } from '@/src/hooks/useMarketplaceDisplayedEntities';

import { isMyApplication } from '@/src/utils/app/id';

import { DialAIEntityModel } from '@/src/types/models';

import { MarketplaceActions, ModelsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors, ModelsSelectors } from '@/src/store/selectors';

import {
  DeleteType,
  FilterTypes,
  MarketplaceEntitiesTabs,
  MarketplaceTabs,
} from '@/src/constants/marketplace';

import { ApplicationDetails } from './ApplicationDetails/ApplicationDetails';
import { ResultsView, ResultsViewProps } from './TabResults';

const AgentsResultsView = ResultsView as React.ComponentType<
  ResultsViewProps<DialAIEntityModel>
>;

export function AgentsTabRenderer() {
  const dispatch = useAppDispatch();

  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);
  const selectedFilters = useAppSelector(
    MarketplaceSelectors.selectSelectedAgentsFilters,
  );
  const searchTerm = useAppSelector(
    MarketplaceSelectors.selectTrimmedSearchTerm,
  );
  const allModels = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const detailsModel = useAppSelector(MarketplaceSelectors.selectDetailsModel);
  const selectedViewType = useAppSelector(
    MarketplaceSelectors.selectSelectedViewType,
  );

  const areAllFiltersEmpty =
    !searchTerm.length &&
    !selectedFilters[FilterTypes.ENTITY_TYPE].length &&
    !selectedFilters[FilterTypes.TOPICS].length &&
    !selectedFilters[FilterTypes.SOURCES].length;

  const { displayedEntities, suggestedResults, featuredEntities } =
    useMarketplaceDisplayedEntities(
      allModels,
      installedModelIds,
      selectedFilters,
      isMyApplication,
    );

  const handleSetDetailsModel = useCallback(
    (model: DialAIEntityModel) => {
      dispatch(
        MarketplaceActions.setDetailsEntity({
          reference: model.reference,
          type: MarketplaceEntitiesTabs.AGENTS,
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
          MarketplaceActions.setDetailsEntity({
            ...detailsModel,
            reference: model.reference,
          }),
        );
      }
    },
    [detailsModel, dispatch],
  );

  const handleCloseDetailsDialog = useCallback(
    () => dispatch(MarketplaceActions.setDetailsEntity()),
    [dispatch],
  );

  const handleBookmarkClick = useCallback(
    (entity: DialAIEntityModel) => {
      if (installedModelIds.has(entity.reference)) {
        dispatch(
          MarketplaceActions.setDeleteEntity({
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

  const currentDetailsModel = detailsModel
    ? modelsMap[detailsModel.reference]
    : undefined;

  return (
    <>
      <AgentsResultsView
        entities={displayedEntities}
        suggestedResults={suggestedResults}
        featuredEntities={featuredEntities}
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
          isSuggested={detailsModel?.isSuggested}
        />
      )}
    </>
  );
}
