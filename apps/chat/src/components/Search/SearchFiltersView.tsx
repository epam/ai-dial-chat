import { IconCircleFilled, IconFilter } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  getNewSearchFiltersValue,
  isSearchFilterSelected,
} from '@/src/utils/app/search';

import { FeatureType } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { SearchFilters } from '@/src/types/search';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import ContextMenu from '../Common/ContextMenu';
import Tooltip from '../Common/Tooltip';
import SearchFilterRenderer from './SearchFilterRenderer';

import { Feature } from '@epam/ai-dial-shared';

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
  const [isOpen, setIsOpen] = useState(false);

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
        // TODO: implement Published by me filter in https://github.com/epam/ai-dial-chat/issues/1440
        // {
        //   display: enabledFeatures.has(
        //     featureType === FeatureType.Chat
        //       ? Feature.ConversationsPublishing
        //       : Feature.PromptsPublishing,
        //   ),
        //   name: t('Published by me'),
        //   dataQa: 'published-by-me-filter',
        //   filterValue: SearchFilters.PublishedByMe,
        // },
      ]
        .filter(({ display }) => display)
        .map(({ filterValue, ...props }) => ({
          ...props,
          onClick: (selected: unknown) => {
            onSearchFiltersChanged(
              getNewSearchFiltersValue(searchFilters, filterValue, !!selected),
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
      featureType={featureType}
      triggerIconClassName="absolute right-4 cursor-pointer max-h-[18px]"
      onOpenChange={setIsOpen}
      TriggerCustomRenderer={
        <Tooltip tooltip={t('Search filter')} hideTooltip={isOpen}>
          <IconFilter
            size={18}
            className={classNames('text-secondary hover:text-accent-primary')}
          />
          {searchFilters !== SearchFilters.None && (
            <IconCircleFilled
              size={8}
              className={classNames(
                'absolute right-0 top-0 bg-layer-0 p-[0.3px] text-accent-primary',
              )}
            />
          )}
        </Tooltip>
      }
    />
  );
}
