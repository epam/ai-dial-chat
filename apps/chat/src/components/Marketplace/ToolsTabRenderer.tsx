import { useCallback } from 'react';

import { useMarketplaceDisplayedEntities } from '@/src/hooks/useMarketplaceDisplayedEntities';

import { ToolsetModel } from '@/src/types/toolsets';

import { ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors, ToolsetSelectors } from '@/src/store/selectors';

import {
  DeleteType,
  FilterTypes,
  MarketplaceTabs,
} from '@/src/constants/marketplace';

import { DeleteMarketplaceEntityDialog } from '@/src/components/Marketplace/DeleteMarketplaceEntityDialog';

import { ResultsView, ResultsViewProps } from './TabResults';
import { ToolsetDetails } from './ToolsetsDetails/ToolsetDetails';

const ToolsetResultsView = ResultsView as React.ComponentType<
  ResultsViewProps<ToolsetModel>
>;

export function ToolsTabRenderer() {
  const dispatch = useAppDispatch();

  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);

  const allToolsets = useAppSelector(ToolsetSelectors.selectToolsets);
  const selectedToolset = useAppSelector(ToolsetSelectors.selectToolsetDetails);
  const installedToolsetsSet = useAppSelector(
    ToolsetSelectors.selectInstalledToolsetsSet,
  );
  const selectedViewType = useAppSelector(
    MarketplaceSelectors.selectSelectedViewType,
  );
  const selectedFilters = useAppSelector(
    MarketplaceSelectors.selectSelectedFilters,
  );
  const searchTerm = useAppSelector(
    MarketplaceSelectors.selectTrimmedSearchTerm,
  );

  const areAllFiltersEmpty =
    !searchTerm.length && !selectedFilters[FilterTypes.TOPICS].length;

  const { displayedEntities: displayedToolsets, suggestedResults } =
    useMarketplaceDisplayedEntities(allToolsets, installedToolsetsSet);

  const handleSetDetailsToolset = useCallback(
    (toolset: { reference: string }) => {
      dispatch(
        ToolsetActions.setToolsetDetails({
          reference: toolset.reference,
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
          ToolsetActions.setToolsetDetails({
            reference: toolset.reference,
          }),
        );
      }
    },
    [selectedToolset, dispatch],
  );

  const handleCloseDetailsDialog = useCallback(
    () => dispatch(ToolsetActions.setToolsetDetails()),
    [dispatch],
  );

  return (
    <>
      <ToolsetResultsView
        entities={displayedToolsets}
        suggestedResults={suggestedResults}
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
        />
      )}

      <DeleteMarketplaceEntityDialog />
    </>
  );
}
