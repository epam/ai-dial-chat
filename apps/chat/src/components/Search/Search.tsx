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
}

export default function Search({
  placeholder,
  searchTerm,
  onSearch,
  searchFilters,
  onSearchFiltersChanged,
  featureType,
}: Props) {
  const { t } = useTranslation(Translation.SideBar);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearch(e.target.value);
    },
    [onSearch],
  );

  return (
    <div className="relative flex items-center py-1 pl-5 pr-2">
      <div className="absolute left-5 flex size-6 shrink-0 items-center justify-center">
        <IconSearch className="text-secondary" size={18} />
      </div>
      <input
        className="w-full bg-transparent py-2 pl-9 pr-8 text-[14px] leading-3 outline-none placeholder:text-secondary"
        data-qa="search"
        type="text"
        placeholder={t(placeholder) || ''}
        value={searchTerm}
        onChange={handleSearchChange}
      />
      <SearchFiltersView
        featureType={featureType}
        onSearchFiltersChanged={onSearchFiltersChanged}
        searchFilters={searchFilters}
      />
    </div>
  );
}
