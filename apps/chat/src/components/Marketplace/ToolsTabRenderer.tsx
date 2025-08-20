import { useCallback, useMemo, useState } from 'react';

import { useFuseSearch } from '@/src/hooks/useFuseSearch';

import { isInstalledEntity } from '@/src/utils/marketplace';

import { ToolsetModel } from '@/src/types/toolsets';

import { ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors, ToolsetSelectors } from '@/src/store/selectors';

import {
  DeleteType,
  MarketplaceTabs,
  ViewTypes,
} from '@/src/constants/marketplace';
import { TOOLSETS_SEARCH_OPTIONS } from '@/src/constants/search';

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
  const bookmarkedToolsetsSet = useAppSelector(
    ToolsetSelectors.selectBookmarkedToolsetsSet,
  );

  const selectedViewType = useAppSelector(
    MarketplaceSelectors.selectSelectedViewType,
  );

  const searchTerm = useAppSelector(
    MarketplaceSelectors.selectTrimmedSearchTerm,
  );

  const [suggestedResults, setSuggestedResults] = useState<ToolsetModel[]>([]);

  //TODO add filters
  const isSomeFilterNotEmpty = searchTerm.length;

  const searchedToolsets = useFuseSearch(
    allToolsets,
    searchTerm,
    TOOLSETS_SEARCH_OPTIONS,
  );

  const displayedToolsets = useMemo(() => {
    //TODO add filters
    const filteredToolsets = searchedToolsets;
    const isBookmarkedToolset = (entity: ToolsetModel) =>
      isInstalledEntity(entity, bookmarkedToolsetsSet);

    const entitiesForTab =
      selectedTab === MarketplaceTabs.MY_WORKSPACE
        ? filteredToolsets.filter(isBookmarkedToolset)
        : filteredToolsets;

    const shouldSuggest =
      selectedTab === MarketplaceTabs.MY_WORKSPACE && isSomeFilterNotEmpty;

    if (selectedViewType === ViewTypes.TABLE) {
      if (shouldSuggest) {
        const suggestedListWithoutBookmarked = filteredToolsets.filter(
          (toolset) => !isBookmarkedToolset(toolset),
        );

        setSuggestedResults(suggestedListWithoutBookmarked);
      } else {
        setSuggestedResults([]);
      }
      return entitiesForTab;
    }

    let toolsetsToDisplay = entitiesForTab.concat(
      shouldSuggest ? filteredToolsets : [],
    );

    if (shouldSuggest) {
      const suggestedListWithoutInstalled = toolsetsToDisplay.filter(
        (toolset) => !isBookmarkedToolset(toolset),
      );
      toolsetsToDisplay = toolsetsToDisplay.filter(isBookmarkedToolset);
      setSuggestedResults(suggestedListWithoutInstalled);
    } else {
      setSuggestedResults([]);
    }

    return toolsetsToDisplay;
  }, [
    bookmarkedToolsetsSet,
    isSomeFilterNotEmpty,
    searchedToolsets,
    selectedTab,
    selectedViewType,
  ]);

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
      if (bookmarkedToolsetsSet.has(toolset.reference)) {
        dispatch(
          ToolsetActions.removeBookmarkedToolsets({
            references: [toolset.reference],
            action: DeleteType.REMOVE,
          }),
        );
      } else {
        dispatch(
          ToolsetActions.addBookmarkedToolsets({
            references: [toolset.reference],
            showSuccessToast: true,
          }),
        );
      }
    },
    [bookmarkedToolsetsSet, dispatch],
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
