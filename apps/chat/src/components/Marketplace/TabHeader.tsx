import classNames from 'classnames';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { EntitiesTabsHeader } from './EntitiesTabsHeader';
import { MarketplaceBanner } from './MarketplaceBanner';
import { SearchHeader } from './SearchHeader';

import { Feature } from '@epam/ai-dial-shared';

interface HeaderProps {
  isBannerVisible: boolean;
  className?: string;
}

export function TabHeader({ isBannerVisible, className }: HeaderProps) {
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
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
          'flex flex-col items-center gap-2 transition-all duration-1000 md:flex-row md:gap-4',
          isBannerVisible ? 'md:mt-4 xl:mt-6' : 'm-0',
          enabledFeatures.has(Feature.Toolsets)
            ? 'justify-between'
            : 'justify-end',
        )}
      >
        {enabledFeatures.has(Feature.Toolsets) && <EntitiesTabsHeader />}
        <SearchHeader />
      </div>
    </header>
  );
}
