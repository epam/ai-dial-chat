import { useCallback, useState } from 'react';

import { ToolsetModel } from '@/src/types/toolsets';

import { ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors, ToolsetSelectors } from '@/src/store/selectors';

import { ResultsView, ResultsViewProps } from './TabResults';

const ToolsetResultsView = ResultsView as React.ComponentType<
  ResultsViewProps<ToolsetModel>
>;

export function ToolsTabRenderer() {
  const dispatch = useAppDispatch();

  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);

  const allToolsets = useAppSelector(ToolsetSelectors.selectToolsets);
  const detailsToolset = useAppSelector(ToolsetSelectors.selectToolsetDetails);

  const selectedViewType = useAppSelector(
    MarketplaceSelectors.selectSelectedViewType,
  );

  const [suggestedResults, setSuggestedResults] = useState<ToolsetModel[]>([]);

  const handleSetDetailsToolset = useCallback(
    (toolset: { reference: string }) => {
      // dispatch(
      //   ToolsetActions.setDetailsToolset({
      //     reference: toolset.reference,
      //     isSuggested: suggestedResults
      //       .map((item) => item.reference)
      //       .includes(toolset.reference),
      //   }),
      // );
    },
    [dispatch, suggestedResults],
  );
  const handleBookmarkClick = useCallback((entity: ToolsetModel) => {}, []);

  return (
    <ToolsetResultsView
      entities={allToolsets}
      suggestedResults={[]}
      selectedTab={selectedTab}
      areAllFiltersEmpty
      selectedViewType={selectedViewType}
      onCardClick={handleSetDetailsToolset}
      onBookmarkClick={handleBookmarkClick}
    />

    // {/* MODALS */}
  );
}
