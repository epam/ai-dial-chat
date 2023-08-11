import { FC } from 'react';

import { useTranslation } from 'next-i18next';

import SearchIcon from '../../public/images/icons/search.svg';

interface Props {
  placeholder: string;
  searchTerm: string;
  onSearch: (searchTerm: string) => void;
}
const Search: FC<Props> = ({ placeholder, searchTerm, onSearch }) => {
  const { t } = useTranslation('sidebar');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  };

  return (
    <div className="relative flex items-center px-5 py-1">
      <SearchIcon
        className="absolute left-5 text-gray-500"
        width={18}
        height={18}
      />
      <input
        className="w-full bg-inherit py-3 pl-8 text-[14px] leading-3 text-inherit placeholder:text-gray-500"
        type="text"
        placeholder={t(placeholder) || ''}
        value={searchTerm}
        onChange={handleSearchChange}
      />
    </div>
  );
};

export default Search;
