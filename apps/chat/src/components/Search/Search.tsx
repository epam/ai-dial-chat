import { useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { FeatureType } from '@/src/types/common';
import { SearchFilters } from '@/src/types/search';
import { Translation } from '@/src/types/translation';

import { SearchFiltersView } from './SearchFiltersView';

import { DialSearch } from '@epam/ai-dial-ui-kit';

interface Props {
  placeholder: string;
  searchTerm: string;
  onSearch: (searchTerm: string) => void;
  onSearchFiltersChanged: (searchFilters: SearchFilters) => void;
  searchFilters: SearchFilters;
  featureType: FeatureType;
}

export function Search({
  placeholder,
  searchTerm,
  onSearch,
  searchFilters,
  onSearchFiltersChanged,
  featureType,
}: Props) {
  const { t } = useTranslation(Translation.SideBar);

  const handleSearchChange = useCallback(
    (value: string) => {
      onSearch(value);
    },
    [onSearch],
  );

  return (
    <div className="relative flex items-center py-1 pl-5 pr-2" data-qa="search">
      <DialSearch
        data-qa="search-input"
        placeholder={t(placeholder)}
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
