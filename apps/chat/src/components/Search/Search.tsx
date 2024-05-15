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
    <div className="relative flex items-center border-quaternary border rounded-2xl my-2 mx-5" data-qa="search">
      <IconSearch
        className="absolute left-4"
        size={18}
        width={18}
        height={18}
      />
      <input
        className="w-full bg-transparent pr-8 pl-12 py-2 text-[14px] leading-3 outline-none placeholder:text-primary-bg-dark"
        type="text"
        placeholder={t(placeholder) || ''}
        value={searchTerm}
        onChange={handleSearchChange}
      />
      {/* PGPT-87 Temporary remove Search Filter component according to the design*/}
      {/*<SearchFiltersView*/}
      {/*  featureType={featureType}*/}
      {/*  onSearchFiltersChanged={onSearchFiltersChanged}*/}
      {/*  searchFilters={searchFilters}*/}
      {/*/>*/}
    </div>
  );
}
