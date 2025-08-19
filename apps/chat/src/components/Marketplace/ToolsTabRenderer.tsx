import { ResultsView, ResultsViewProps } from './TabResults';
import { ToolsetDetails } from './ToolsetsDetails/ToolsetDetails';

import { MarketplaceTabs } from '@/src/constants/marketplace';
import { ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors, ToolsetSelectors } from '@/src/store/selectors';
import { ToolsetModel } from '@/src/types/toolsets';
import { useCallback } from 'react';

const ToolsetResultsView = ResultsView as React.ComponentType<
  ResultsViewProps<ToolsetModel>
>;

export function ToolsTabRenderer() {
  const dispatch = useAppDispatch();

  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);

  const allToolsets = useAppSelector(ToolsetSelectors.selectToolsets);
  const selectedToolset = useAppSelector(ToolsetSelectors.selectToolsetDetails);

  const selectedViewType = useAppSelector(
    MarketplaceSelectors.selectSelectedViewType,
  );

  // TODO implement suggestedResults
  // const [suggestedResults, setSuggestedResults] = useState<ToolsetModel[]>([]);

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

  const handleBookmarkClick = useCallback(() => {
    // (entity: ToolsetModel) => {
    //TODO implement onBookmarkClick
  }, []);

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
        entities={allToolsets}
        suggestedResults={[]}
        selectedTab={selectedTab}
        areAllFiltersEmpty
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
    </>
  );
}
