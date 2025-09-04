import { useCallback } from 'react';

import { useMarketplaceDisplayedEntities } from '@/src/hooks/useMarketplaceDisplayedEntities';

import { DialAIEntityModel } from '@/src/types/models';

import { MarketplaceActions, ModelsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors, ModelsSelectors } from '@/src/store/selectors';

import {
  DeleteType,
  FilterTypes,
  MarketplaceTabs,
} from '@/src/constants/marketplace';

import { AgentDialogs } from '@/src/components//Common/AgentDialogs';

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

  const areAllFiltersEmpty =
    !searchTerm.length &&
    !selectedFilters[FilterTypes.ENTITY_TYPE].length &&
    !selectedFilters[FilterTypes.TOPICS].length &&
    !selectedFilters[FilterTypes.SOURCES].length;

  const { displayedEntities, suggestedResults } =
    useMarketplaceDisplayedEntities(allModels, installedModelIds);

  const handleSetDetailsModel = useCallback(
    (model: DialAIEntityModel) => {
      dispatch(
        MarketplaceActions.setDetailsEntity({
          entity: model,
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
            isSuggested: detailsModel.isSuggested,
            entity: model,
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

  const currentDetailsModel = detailsModel?.entity;

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
}
