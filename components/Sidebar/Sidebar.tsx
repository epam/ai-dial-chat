import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { FeatureType } from '@/types/components';
import { FolderInterface } from '@/types/folder';

import { NoResultsFound } from '../Common/NoResultsFound';
import Search from '../Search';

import classNames from 'classnames';

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
  featureType: FeatureType;
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
  featureType,
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
      className={classNames(
        `fixed top-12 z-40 flex h-full w-[260px] flex-none shrink-0 flex-col divide-y  divide-gray-300 border-r border-gray-300 bg-gray-100 text-gray-800 transition-all dark:divide-gray-900 dark:border-gray-900 dark:bg-gray-700 dark:text-gray-200 max-md:h-[calc(100%-48px)] lg:relative lg:top-0`,
        `${side}-0`,
      )}
    >
      <Search
        placeholder={t('Search {{name}}...', { name: featureType })}
        searchTerm={searchTerm}
        onSearch={handleSearchTerm}
      />
      {actionButtons}
      <div className="grow overflow-auto">
        {folders?.length > 0 && (
          <div className="flex p-2">{folderComponent}</div>
        )}

        {items?.length > 0 ? (
          <div
            className="min-w-[42px] border-t border-gray-100 dark:border-gray-900"
            onDrop={handleDrop}
            onDragOver={allowDrop}
            onDragEnter={highlightDrop}
            onDragLeave={removeHighlight}
          >
            {itemComponent}
          </div>
        ) : (
          <div className="flex content-center justify-center">
            <NoResultsFound />
          </div>
        )}
      </div>
      {footerComponent}
    </div>
  ) : null;
};

export default Sidebar;
