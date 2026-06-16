import { IconCircleFilled, IconFilter } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getNewSearchFiltersValue,
  isSearchFilterSelected,
} from '@/src/utils/app/search';

import { FeatureType, ScreenState } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { SearchFilters } from '@/src/types/search';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { PromptBarI18nKeys } from '@/src/constants/i18n';

import { ContextMenu } from '@/src/components/Common/ContextMenu';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { SearchFilterRenderer } from './SearchFilterRenderer';

import { Feature } from '@epam/ai-dial-shared';

interface Props {
  onSearchFiltersChanged: (searchFilters: SearchFilters) => void;
  searchFilters: SearchFilters;
  featureType: FeatureType;
}

export function SearchFiltersView({
  onSearchFiltersChanged,
  searchFilters,
  featureType,
}: Props) {
  const translationNamespace =
    featureType === FeatureType.Chat
      ? Translation.SideBar
      : Translation.PromptBar;

  const { t } = useTranslation(translationNamespace);

  const translateFilterLabel = useCallback(
    (key: string) => {
      const primary = t(key);
      if (featureType !== FeatureType.Chat || primary !== key) {
        return primary;
      }

      return t(key, { ns: Translation.PromptBar });
    },
    [featureType, t],
  );

  const [isOpen, setIsOpen] = useState(false);
  const screenState = useScreenState();
  const isMobileView = screenState === ScreenState.SM;

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
          name: translateFilterLabel(PromptBarI18nKeys.SharedByMe),
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
    [
      enabledFeatures,
      featureType,
      translateFilterLabel,
      searchFilters,
      onSearchFiltersChanged,
    ],
  );

  return (
    <ContextMenu
      menuItems={filterItems}
      featureType={featureType}
      triggerIconClassName="absolute end-4 cursor-pointer max-h-[18px]"
      onOpenChange={setIsOpen}
      TriggerCustomRenderer={
        <Tooltip
          tooltip={translateFilterLabel(PromptBarI18nKeys.SearchFilters)}
          hideTooltip={isOpen || isMobileView}
        >
          <IconFilter
            size={18}
            className={classNames('text-secondary hover:text-accent-primary')}
          />
          {searchFilters !== SearchFilters.None && (
            <IconCircleFilled
              size={8}
              className={classNames(
                'absolute end-0 top-0 bg-layer-0 p-[0.3px] text-accent-primary',
              )}
            />
          )}
        </Tooltip>
      }
    />
  );
}
