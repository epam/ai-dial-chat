import { useCallback } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { MarketplaceActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors, SettingsSelectors } from '@/src/store/selectors';

import { MarketplaceEntitiesTabs } from '@/src/constants/marketplace';

import { MarketplaceBanner } from './MarketplaceBanner';
import { SearchHeader } from './SearchHeader';

import { Feature } from '@epam/ai-dial-shared';

interface HeaderProps {
  isBannerVisible: boolean;
  className?: string;
}

export function TabHeader({ isBannerVisible, className }: HeaderProps) {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  const selectedEntitiesTab = useAppSelector(
    MarketplaceSelectors.selectSelectedEntitiesTab,
  );

  const isAgentsTab = selectedEntitiesTab === MarketplaceEntitiesTabs.AGENTS;

  const handleSelectTab = useCallback(
    (tabId: MarketplaceEntitiesTabs) => {
      dispatch(MarketplaceActions.setSelectedEntitiesTab(tabId));
    },
    [dispatch],
  );

  return (
    <header
      className={classNames(
        'mb-5 px-3 md:mb-4 md:px-5 xl:mb-6 xl:px-16',
        className,
      )}
      data-qa="marketplace-header"
    >
      <div
        className={classNames(
          'w-full transition-all duration-1000',
          isBannerVisible
            ? 'max-h-[104px] translate-y-0'
            : 'max-h-0 translate-y-[-135px]',
        )}
      >
        <MarketplaceBanner />
      </div>
      <div
        className={classNames(
          'flex items-center gap-2 transition-all duration-1000 md:gap-4',
          isBannerVisible ? 'md:mt-4 xl:mt-6' : 'm-0',
          enabledFeatures.has(Feature.Toolsets)
            ? 'justify-between'
            : 'justify-end',
        )}
      >
        {enabledFeatures.has(Feature.Toolsets) && (
          <div className="flex gap-3">
            <span
              onClick={() => {
                handleSelectTab(MarketplaceEntitiesTabs.AGENTS);
              }}
              className={classNames(
                'cursor-pointer rounded border border-transparent bg-accent-primary-alpha px-3 py-2.5 hover:bg-layer-4',
                isAgentsTab ? 'border-b-accent-primary' : 'bg-layer-4',
              )}
            >
              {t('Agents')}
            </span>
            <span
              onClick={() => {
                handleSelectTab(MarketplaceEntitiesTabs.TOOLSETS);
              }}
              className={classNames(
                'cursor-pointer rounded border border-transparent bg-accent-primary-alpha px-3 py-2.5 hover:bg-layer-4',
                !isAgentsTab ? 'border-b-accent-primary' : 'bg-layer-4',
              )}
            >
              {t('Toolsets')}
            </span>
          </div>
        )}
        <SearchHeader />
      </div>
    </header>
  );
}
