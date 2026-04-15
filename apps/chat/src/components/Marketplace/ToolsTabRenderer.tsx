import React, { useCallback } from 'react';

import { useMarketplaceDisplayedEntities } from '@/src/hooks/useMarketplaceDisplayedEntities';

import { ToolsetModel } from '@/src/types/toolsets';

import { MarketplaceActions, ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors, ToolsetSelectors } from '@/src/store/selectors';

import {
  DeleteType,
  FilterTypes,
  MarketplaceEntitiesTabs,
  MarketplaceTabs,
} from '@/src/constants/marketplace';

import { ResultsView, ResultsViewProps } from './TabResults';
import { ToolsetDetails } from './ToolsetsDetails/ToolsetDetails';

const ToolsetResultsView = ResultsView as React.ComponentType<
  ResultsViewProps<ToolsetModel>
>;

export function ToolsTabRenderer() {
  const dispatch = useAppDispatch();

  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);

  const allToolsets = useAppSelector(ToolsetSelectors.selectToolsets);
  const toolsetsMap = useAppSelector(ToolsetSelectors.selectToolsetsMap);
  const detailsToolset = useAppSelector(
    MarketplaceSelectors.selectDetailsToolset,
  );
  const installedToolsetsSet = useAppSelector(
    ToolsetSelectors.selectInstalledToolsetsSet,
  );
  const selectedViewType = useAppSelector(
    MarketplaceSelectors.selectSelectedViewType,
  );

  const selectedFilters = useAppSelector(
    MarketplaceSelectors.selectSelectedToolsetsFilters,
  );
  const searchTerm = useAppSelector(
    MarketplaceSelectors.selectTrimmedSearchTerm,
  );

  const areAllFiltersEmpty =
    !searchTerm.length && !selectedFilters[FilterTypes.TOPICS].length;
  const selectedToolset = detailsToolset
    ? toolsetsMap[detailsToolset.reference]
    : undefined;

  const {
    displayedEntities: displayedToolsets,
    suggestedResults,
    featuredEntities,
  } = useMarketplaceDisplayedEntities(
    allToolsets,
    installedToolsetsSet,
    selectedFilters,
  );

  const handleSetDetailsToolset = useCallback(
    (toolset: ToolsetModel) => {
      dispatch(
        MarketplaceActions.setDetailsEntity({
          reference: toolset.reference,
          isSuggested: suggestedResults
            .map((item) => item.reference)
            .includes(toolset.reference),
          type: MarketplaceEntitiesTabs.TOOLSETS,
        }),
      );
    },
    [dispatch, suggestedResults],
  );

  const handleBookmarkClick = useCallback(
    (toolset: ToolsetModel) => {
      if (installedToolsetsSet.has(toolset.reference)) {
        dispatch(
          MarketplaceActions.setDeleteEntity({
            entity: toolset,
            action: DeleteType.REMOVE,
          }),
        );
      } else {
        dispatch(
          ToolsetActions.addInstalledToolsets({
            references: [toolset.reference],
            showSuccessToast: true,
          }),
        );
      }
    },
    [installedToolsetsSet, dispatch],
  );

  const handleSetVersion = useCallback(
    (toolset: ToolsetModel) => {
      if (detailsToolset) {
        dispatch(
          MarketplaceActions.setDetailsEntity({
            ...detailsToolset,
            reference: toolset.reference,
          }),
        );
      }
    },
    [detailsToolset, dispatch],
  );

  const handleCloseDetailsDialog = useCallback(
    () => dispatch(MarketplaceActions.setDetailsEntity()),
    [dispatch],
  );

  return (
    <>
      <ToolsetResultsView
        entities={displayedToolsets}
        suggestedResults={suggestedResults}
        featuredEntities={featuredEntities}
        selectedTab={selectedTab}
        areAllFiltersEmpty={areAllFiltersEmpty}
        selectedViewType={selectedViewType}
        onCardClick={handleSetDetailsToolset}
        onBookmarkClick={handleBookmarkClick}
      />

      {/* MODALS */}

      {selectedToolset && (
        <ToolsetDetails
          entity={selectedToolset}
          allEntities={allToolsets}
          isMyWorkspaceTab={selectedTab === MarketplaceTabs.MY_WORKSPACE}
          onClose={handleCloseDetailsDialog}
          onChangeVersion={handleSetVersion}
          onBookmarkClick={handleBookmarkClick}
          isSuggested={detailsToolset?.isSuggested}
        />
      )}
    </>
  );
}
