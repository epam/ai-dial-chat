import { FC, useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import SearchIcon from '../../../public/images/icons/search.svg';

interface Props {
  placeholder: string;
  searchTerm: string;
  onSearch: (searchTerm: string) => void;
}
const Search: FC<Props> = ({ placeholder, searchTerm, onSearch }) => {
  const { t } = useTranslation(Translation.SideBar);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearch(e.target.value);
    },
    [onSearch],
  );

  return (
    <div className="relative flex items-center py-1 pl-5 pr-2">
      <SearchIcon
        className="absolute left-5 text-secondary"
        width={18}
        height={18}
      />
      <input
        className="w-full bg-transparent py-2 pl-8 text-[14px] leading-3 outline-none placeholder:text-secondary"
        type="text"
        placeholder={t(placeholder) || ''}
        value={searchTerm}
        onChange={handleSearchChange}
      />
    </div>
  );
};

export default Search;
