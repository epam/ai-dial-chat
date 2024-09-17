import { IconSearch } from '@tabler/icons-react';
import { ChangeEvent } from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  MarketplaceActions,
  MarketplaceSelectors,
} from '@/src/store/marketplace/marketplace.reducers';

import { MarketplaceTabs } from '@/src/constants/marketplace';

const countLabel = {
  [MarketplaceTabs.HOME]: 'Home page',
  [MarketplaceTabs.MY_APPLICATIONS]: 'My applications',
};

interface SearchHeaderProps {
  items: number;
}

export const SearchHeader = ({ items }: SearchHeaderProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const searchTerm = useAppSelector(MarketplaceSelectors.selectSearchTerm);
  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);

  const onSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    dispatch(MarketplaceActions.setSearchTerm(e.target.value));
  };

  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="hidden text-secondary sm:block">
        {t('{{label}}: {{count}} applications', {
          count: items,
          label: countLabel[selectedTab],
          nsSeparator: '::',
        })}
      </div>
      <div className="relative w-full sm:w-[315px] md:w-[560px]">
        <IconSearch
          className="absolute left-3 top-1/2 -translate-y-1/2"
          size={18}
        />
        <input
          name="titleInput"
          placeholder={t('Search') || ''}
          type="text"
          value={searchTerm}
          onChange={onSearchChange}
          className="w-full rounded border-[1px] border-primary bg-transparent py-[11px] pl-[38px] pr-3 leading-4 outline-none placeholder:text-secondary focus-visible:border-accent-primary"
        />
      </div>
    </div>
  );
};
