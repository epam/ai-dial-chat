import { ReactNode, useCallback, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { FeatureType } from '@/src/types/components';
import { FolderInterface } from '@/src/types/folder';

import { NoData } from '../Common/NoData';
import { NoResultsFound } from '../Common/NoResultsFound';
import Search from '../Search';

import classNames from 'classnames';

interface Props<T> {
  isOpen: boolean;
  side: 'left' | 'right';
  items: T[];
  filteredItems: T[];
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
  filteredItems,
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
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragDropElement = useRef<HTMLDivElement>(null);
  const draggingColor = side === 'left' ? 'bg-green/15' : 'bg-violet/15';
  const allowDrop = useCallback((e: any) => {
    e.preventDefault();
  }, []);

  const highlightDrop = useCallback((e: any) => {
    if (
      dragDropElement.current?.contains(e.target) ||
      dragDropElement.current === e.target
    ) {
      setIsDraggingOver(true);
    }
  }, []);

  const removeHighlight = useCallback((e: any) => {
    if (
      (e.target === dragDropElement.current ||
        dragDropElement.current?.contains(e.target)) &&
      !dragDropElement.current?.contains(e.relatedTarget)
    ) {
      setIsDraggingOver(false);
    }
  }, []);

  return isOpen ? (
    <div
      className={classNames(
        `fixed top-12 z-40 flex h-full w-[260px] flex-none shrink-0 flex-col divide-y divide-gray-300 border-r border-gray-300 bg-gray-100 transition-all dark:divide-gray-900 dark:border-gray-900 dark:bg-gray-700  max-lg:h-[calc(100%-48px)] lg:relative lg:top-0`,
        `${side}-0`,
      )}
      data-qa="sidebar"
    >
      <Search
        placeholder={t('Search {{name}}...', { name: featureType })}
        searchTerm={searchTerm}
        onSearch={handleSearchTerm}
      />
      {actionButtons}
      <div className="flex grow flex-col gap-[1px] divide-y divide-gray-300 overflow-auto dark:divide-gray-900">
        {folders?.length > 0 && (
          <div className="flex p-2">{folderComponent}</div>
        )}

        {filteredItems?.length > 0 ? (
          <div
            ref={dragDropElement}
            className={`min-h-[100px] min-w-[42px] grow border-t border-gray-100 dark:border-gray-900 ${
              isDraggingOver ? draggingColor : ''
            }`}
            onDrop={(e) => {
              setIsDraggingOver(false);
              handleDrop(e);
            }}
            onDragOver={allowDrop}
            onDragEnter={highlightDrop}
            onDragLeave={removeHighlight}
          >
            {itemComponent}
          </div>
        ) : items.length !== 0 ? (
          <div className="flex grow content-center justify-center">
            <NoResultsFound />
          </div>
        ) : (
          <div className="flex grow content-center justify-center">
            <NoData />
          </div>
        )}
      </div>
      {footerComponent}
    </div>
  ) : null;
};

export default Sidebar;
