import { IconCircleFilled, IconFilter } from '@tabler/icons-react';
import { useMemo } from 'react';

import classNames from 'classnames';

import { getByHighlightColor } from '@/src/utils/app/folders';
import {
  getNewSearchFiltersValue,
  isSearchFilterSelected,
} from '@/src/utils/app/search';

import { FeatureType, HighlightColor } from '@/src/types/common';
import { Feature } from '@/src/types/features';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { SearchFilters } from '@/src/types/search';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import ContextMenu from '../Common/ContextMenu';
import SearchFilterRenderer from './SearchFilterRenderer';

interface Props {
  searchTerm: string;
  onSearch: (searchTerm: string, searchFilters: SearchFilters) => void;
  searchFilters: SearchFilters;
  featureType: FeatureType;
}

export default function SearchFiltersView({
  searchTerm,
  onSearch,
  searchFilters,
  featureType,
}: Props) {
    const highlightColor =
    featureType === FeatureType.Chat
      ? HighlightColor.Green
      : HighlightColor.Violet;

    const enabledFeatures = useAppSelector(
        SettingsSelectors.selectEnabledFeatures,
    );

    const filterItems: DisplayMenuItemProps[] = useMemo(
    () =>
      [
        {
          display: enabledFeatures.has(
            featureType === FeatureType.Chat
              ? Feature.ConversationsSharing
              : Feature.PromptsSharing,
          ),
          name: 'Shared by me',
          dataQa: 'shared-by-me-filter',
          filterValue: SearchFilters.SharedByMe,
        },
        {
          display: enabledFeatures.has(
            featureType === FeatureType.Chat
              ? Feature.ConversationsPublishing
              : Feature.PromptsPublishing,
          ),
          name: 'Published by me',
          dataQa: 'published-by-me-filter',
          filterValue: SearchFilters.PublishedByMe,
        },
      ]
      .filter(({ display }) => display)
      .map(({ filterValue, ...props })=> ({
          ...props,
          onClick: (selected: boolean) => {
            onSearch(
              searchTerm,
              getNewSearchFiltersValue(
                searchFilters,
                filterValue,
                selected,
              ),
            );
          },
          CustomTriggerRenderer: SearchFilterRenderer,
          customTriggerData: isSearchFilterSelected(
            searchFilters,
            filterValue,
          ),
        })),
    [enabledFeatures, featureType, searchFilters, onSearch, searchTerm],
  );

  return (
    <ContextMenu
        menuItems={filterItems}
        highlightColor={highlightColor}
        triggerIconClassName="absolute right-4 cursor-pointer max-h-[18px]"
        TriggerCustomRenderer={
          <>
            <IconFilter size={18} className=" text-gray-500" />
            {searchFilters != SearchFilters.None && (
              <IconCircleFilled
                size={8}
                className={classNames(
                  'absolute right-0 top-0 bg-gray-100 p-[0.3px]  dark:bg-gray-700',
                  getByHighlightColor(
                    highlightColor,
                    'text-green',
                    'text-violet',
                  ),
                )}
              />
            )}
          </>
        }
      />
  );
}
