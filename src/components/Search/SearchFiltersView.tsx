import { IconCircleFilled, IconFilter } from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

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
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import ContextMenu from '../Common/ContextMenu';
import SearchFilterRenderer from './SearchFilterRenderer';

interface Props {
  onSearchFiltersChanged: (searchFilters: SearchFilters) => void;
  searchFilters: SearchFilters;
  featureType: FeatureType;
}

export default function SearchFiltersView({
  onSearchFiltersChanged,
  searchFilters,
  featureType,
}: Props) {
  const { t } = useTranslation(
    featureType === FeatureType.Chat
      ? Translation.SideBar
      : Translation.PromptBar,
  );

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
          name: t('Shared by me'),
          dataQa: 'shared-by-me-filter',
          filterValue: SearchFilters.SharedByMe,
        },
        {
          display: enabledFeatures.has(
            featureType === FeatureType.Chat
              ? Feature.ConversationsPublishing
              : Feature.PromptsPublishing,
          ),
          name: t('Published by me'),
          dataQa: 'published-by-me-filter',
          filterValue: SearchFilters.PublishedByMe,
        },
      ]
        .filter(({ display }) => display)
        .map(({ filterValue, ...props }) => ({
          ...props,
          onClick: (selected: boolean) => {
            onSearchFiltersChanged(
              getNewSearchFiltersValue(searchFilters, filterValue, selected),
            );
          },
          CustomTriggerRenderer: SearchFilterRenderer,
          customTriggerData: isSearchFilterSelected(searchFilters, filterValue),
        })),
    [enabledFeatures, featureType, t, searchFilters, onSearchFiltersChanged],
  );

  return (
    <ContextMenu
      menuItems={filterItems}
      highlightColor={highlightColor}
      triggerIconClassName="absolute right-4 cursor-pointer max-h-[18px]"
      TriggerCustomRenderer={
        <>
          <IconFilter
            size={18}
            className={classNames(
              ' text-gray-500',
              getByHighlightColor(
                highlightColor,
                'hover:text-green',
                'hover:text-violet',
              ),
            )}
          />
          {searchFilters !== SearchFilters.None && (
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
