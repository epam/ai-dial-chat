import { IconMistOff } from '@tabler/icons-react';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { FolderInterface } from '@/types/folder';

import Search from '../Search';

interface Props<T> {
  isOpen: boolean;
  side: 'left' | 'right';
  items: T[];
  itemComponent: ReactNode;
  folderComponent: ReactNode;
  actionButtons: ReactNode;
  folders: FolderInterface[];
  footerComponent?: ReactNode;
  searchTerm: string;
  handleSearchTerm: (searchTerm: string) => void;
  toggleOpen?: () => void;
  handleDrop: (e: any) => void;
}

const Sidebar = <T,>({
  isOpen,
  actionButtons,
  side,
  items,
  itemComponent,
  folderComponent,
  folders,
  footerComponent,
  searchTerm,
  handleSearchTerm,
  handleDrop,
}: Props<T>) => {
  const { t } = useTranslation('promptbar');

  const allowDrop = (e: any) => {
    e.preventDefault();
  };

  const highlightDrop = (e: any) => {
    e.target.style.background = '#343541';
  };

  const removeHighlight = (e: any) => {
    e.target.style.background = 'none';
  };

  return isOpen ? (
    <div
      className={`fixed top-12 ${side}-0 z-40 flex h-full w-[260px] flex-none flex-col space-y-2 bg-gray-100 p-2 text-[14px] transition-all dark:bg-gray-900 lg:relative lg:top-0`} data-qa="sidebar"
    >
      {actionButtons}
      <Search
        placeholder={t('Search...') || ''}
        searchTerm={searchTerm}
        onSearch={handleSearchTerm}
      />

      <div className="grow overflow-auto">
        {folders?.length > 0 && (
          <div className="flex border-b border-white/20 pb-2">
            {folderComponent}
          </div>
        )}

        {items?.length > 0 ? (
          <div
            className="pt-2"
            onDrop={handleDrop}
            onDragOver={allowDrop}
            onDragEnter={highlightDrop}
            onDragLeave={removeHighlight}
          >
            {itemComponent}
          </div>
        ) : (
          <div className="mt-8 select-none text-center opacity-50">
            <IconMistOff className="mx-auto mb-3" />
            <span className="text-[14px] leading-normal">{t('No data.')}</span>
          </div>
        )}
      </div>
      {footerComponent}
    </div>
  ) : null;
};

export default Sidebar;
