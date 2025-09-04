import { useCallback } from 'react';

import { useMarketplaceDisplayedEntities } from '@/src/hooks/useMarketplaceDisplayedEntities';

import { ToolsetModel } from '@/src/types/toolsets';

import { MarketplaceActions, ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors, ToolsetSelectors } from '@/src/store/selectors';

import { DeleteType, MarketplaceTabs } from '@/src/constants/marketplace';

import { DeleteMarketplaceEntityDialog } from '@/src/components/Marketplace/DeleteMarketplaceEntityDialog';
import { ToolsetLoginDialog } from '@/src/components/Marketplace/ToolsetLoginDialog';

import { ResultsView, ResultsViewProps } from './TabResults';
import { ToolsetDetails } from './ToolsetsDetails/ToolsetDetails';

const ToolsetResultsView = ResultsView as React.ComponentType<
  ResultsViewProps<ToolsetModel>
>;

export function ToolsTabRenderer() {
  const dispatch = useAppDispatch();

  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);

  const allToolsets = useAppSelector(ToolsetSelectors.selectToolsets);
  const selectedToolset = useAppSelector(
    MarketplaceSelectors.selectDetailsToolset,
  );
  const installedToolsetsSet = useAppSelector(
    ToolsetSelectors.selectInstalledToolsetsSet,
  );
  const selectedViewType = useAppSelector(
    MarketplaceSelectors.selectSelectedViewType,
  );

  const { displayedEntities: displayedToolsets, suggestedResults } =
    useMarketplaceDisplayedEntities(allToolsets, installedToolsetsSet);

  const handleSetDetailsToolset = useCallback(
    (toolset: ToolsetModel) => {
      dispatch(
        MarketplaceActions.setDetailsEntity({
          entity: toolset,
          isSuggested: false,
        }),
      );
    },
    [dispatch],
  );

  const handleBookmarkClick = useCallback(
    (toolset: ToolsetModel) => {
      if (installedToolsetsSet.has(toolset.reference)) {
        dispatch(
          ToolsetActions.removeInstalledToolsets({
            references: [toolset.reference],
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
      if (selectedToolset) {
        dispatch(
          MarketplaceActions.setDetailsEntity({
            entity: toolset,
            isSuggested: selectedToolset.isSuggested,
          }),
        );
      }
    },
    [selectedToolset, dispatch],
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
        selectedTab={selectedTab}
        areAllFiltersEmpty
        selectedViewType={selectedViewType}
        onCardClick={handleSetDetailsToolset}
        onBookmarkClick={handleBookmarkClick}
      />

      {/* MODALS */}

      {selectedToolset?.entity && (
        <ToolsetDetails
          entity={selectedToolset.entity}
          allEntities={allToolsets}
          isMyWorkspaceTab={selectedTab === MarketplaceTabs.MY_WORKSPACE}
          onClose={handleCloseDetailsDialog}
          onChangeVersion={handleSetVersion}
          onBookmarkClick={handleBookmarkClick}
        />
      )}

      <ToolsetLoginDialog />
      <DeleteMarketplaceEntityDialog />
    </>
  );
}
