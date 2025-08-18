import { ApplicationDetails } from './ApplicationDetails/ApplicationDetails';
import { ResultsView, ResultsViewProps } from './TabResults';

import { MarketplaceActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors, ToolsetSelectors } from '@/src/store/selectors';
import { ToolsetModel } from '@/src/types/toolsets';
import { useCallback, useState } from 'react';

const ToolsetResultsView = ResultsView as React.ComponentType<
  ResultsViewProps<ToolsetModel>
>;

export function ToolsTabRenderer() {
  const dispatch = useAppDispatch();

  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);

  const allToolsets = useAppSelector(ToolsetSelectors.selectToolsets);
  const detailsToolset = useAppSelector(
    MarketplaceSelectors.selectDetailsToolset,
  );

  const selectedViewType = useAppSelector(
    MarketplaceSelectors.selectSelectedViewType,
  );

  const [suggestedResults, setSuggestedResults] = useState<ToolsetModel[]>([]);

  const handleSetDetailsToolset = useCallback(
    (toolset: { reference: string }) => {
      dispatch(
        MarketplaceActions.setDetailsToolset({
          reference: toolset.reference,
          isSuggested: suggestedResults
            .map((item) => item.reference)
            .includes(toolset.reference),
        }),
      );
    },
    [dispatch, suggestedResults],
  );
  const handleBookmarkClick = useCallback((entity: ToolsetModel) => {}, []);

  return (
    <ToolsetResultsView
      entities={allToolsets}
      suggestedResults={[]}
      selectedTab={selectedTab}
      areAllFiltersEmpty={true}
      selectedViewType={selectedViewType}
      onCardClick={handleSetDetailsToolset}
      onBookmarkClick={handleBookmarkClick}
    />

    // {/* MODALS */}
  );
}
