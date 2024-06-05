import { IconSearch } from '@tabler/icons-react';
import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { FeatureType } from '@/src/types/common';
import { SearchFilters } from '@/src/types/search';
import { Translation } from '@/src/types/translation';

import SearchFiltersView from './SearchFiltersView';

interface Props {
  placeholder: string;
  searchTerm: string;
  onSearch: (searchTerm: string) => void;
  onSearchFiltersChanged: (searchFilters: SearchFilters) => void;
  searchFilters: SearchFilters;
  featureType: FeatureType;
  isShowSearchFilter?: boolean;
}

export default function Search({
  placeholder,
  searchTerm,
  onSearch,
  searchFilters,
  onSearchFiltersChanged,
  featureType,
  isShowSearchFilter = false,
}: Props) {
  const { t } = useTranslation(Translation.SideBar);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearch(e.target.value);
    },
    [onSearch],
  );

  return (
    <div
      className="relative mx-5 my-2 flex items-center rounded-full border border-quaternary"
      data-qa="search"
    >
      <IconSearch
        className="absolute left-4"
        size={18}
        width={18}
        height={18}
      />
      <input
        className="w-full bg-transparent py-2 pl-12 pr-8 text-[14px] leading-3 outline-none placeholder:text-primary-bg-dark"
        type="text"
        placeholder={t(placeholder) || ''}
        value={searchTerm}
        onChange={handleSearchChange}
      />
      {isShowSearchFilter && (
        <SearchFiltersView
          featureType={featureType}
          onSearchFiltersChanged={onSearchFiltersChanged}
          searchFilters={searchFilters}
        />
      )}
    </div>
  );
}
