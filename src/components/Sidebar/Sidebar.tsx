import { ReactNode, useCallback, useMemo, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { FeatureType } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import {
  HEADER_HEIGHT,
  SIDEBAR_MIN_WIDTH,
} from '@/src/constants/default-ui-settings';

import { NoData } from '../Common/NoData';
import { NoResultsFound } from '../Common/NoResultsFound';
import Search from '../Search';
import { LeftSideResizeIcon, RightSideResizeIcon } from './ResizeIcons';

import { Resizable, ResizableProps } from 're-resizable';

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
  const { t } = useTranslation(Translation.PromptBar);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragDropElement = useRef<HTMLDivElement>(null);
  const sideBarElementRef = useRef<Resizable>(null);
  const dispatch = useAppDispatch();
  const chatbarWidth = useAppSelector(UISelectors.selectChatbarWidth);
  const promptbarWidth = useAppSelector(UISelectors.selectPromptbarWidth);

  const isLeftSidebar = side === 'left';
  const isRightSidebar = side === 'right';
  const dataQa = useMemo(
    () => (isLeftSidebar ? 'chatbar' : 'promptbar'),
    [isLeftSidebar],
  );
  const draggingColor = isLeftSidebar ? 'bg-green/15' : 'bg-violet/15';
  const resizeTriggerColor = isLeftSidebar
    ? 'bg-green text-green'
    : 'bg-violet text-violet';

  const SIDEBAR_DEFAULT_WIDTH = useMemo(
    () => (isLeftSidebar ? chatbarWidth : promptbarWidth),
    [isLeftSidebar, chatbarWidth, promptbarWidth],
  );
  const SIDEBAR_HEIGHT = `calc(100%-${HEADER_HEIGHT}px)`;

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

  const onResizeStart = useCallback(() => {
    setIsResizing(true);
  }, []);

  const onResizeStop = useCallback(() => {
    setIsResizing(false);
    const resizibleWidth =
      sideBarElementRef.current?.resizable?.getClientRects()[0].width &&
      Math.round(
        sideBarElementRef.current?.resizable?.getClientRects()[0].width,
      );

    const width = resizibleWidth ?? SIDEBAR_MIN_WIDTH;

    if (isLeftSidebar) {
      dispatch(UIActions.setChatbarWidth(width));
    }

    if (isRightSidebar) {
      dispatch(UIActions.setPromptbarWidth(width));
    }
  }, [dispatch, isLeftSidebar, isRightSidebar]);

  const resizeTriggerClassName = classNames(
    'invisible h-full w-[2px] group-hover:visible md:visible',
    resizeTriggerColor,
    isResizing ? 'xl:visible' : 'xl:invisible',
  );

  const resizeSettings: ResizableProps = useMemo(() => {
    return {
      defaultSize: {
        width: SIDEBAR_DEFAULT_WIDTH ?? SIDEBAR_MIN_WIDTH,
        height: SIDEBAR_HEIGHT,
      },
      enable: {
        top: false,
        right: isLeftSidebar,
        bottom: false,
        left: isRightSidebar,
        topRight: false,
        bottomRight: false,
        bottomLeft: false,
        topLeft: false,
      },
      handleClasses: {
        right: 'group invisible md:visible',
        left: 'group invisible md:visible',
      },
      handleStyles: { right: { right: '-10px' }, left: { left: '0px' } },
      handleComponent: {
        left: <LeftSideResizeIcon className={resizeTriggerClassName} />,
        right: <RightSideResizeIcon className={resizeTriggerClassName} />,
      },
      onResizeStart: onResizeStart,
      onResizeStop: onResizeStop,
    };
  }, [
    onResizeStart,
    onResizeStop,
    resizeTriggerClassName,
    isLeftSidebar,
    isRightSidebar,
    SIDEBAR_HEIGHT,
    SIDEBAR_DEFAULT_WIDTH,
  ]);

  const sideBarClassName = classNames(
    `group/sidebar !fixed top-12 z-40 flex h-[calc(100%-48px)] min-w-[260px] flex-none shrink-0 select-none flex-col divide-y divide-gray-300 border-r border-gray-300 bg-gray-100 transition-all dark:divide-gray-900 dark:border-gray-900 dark:bg-gray-700 md:max-w-[45%]  xl:!relative xl:top-0 xl:h-full`,
    side === 'left' ? 'left-0' : 'right-0',
  );

  return isOpen ? (
    <Resizable
      ref={sideBarElementRef}
      {...resizeSettings}
      className={sideBarClassName}
      data-qa={dataQa}
    >
      <Search
        placeholder={t('Search {{name}}...', { name: featureType })}
        searchTerm={searchTerm}
        onSearch={handleSearchTerm}
      />
      {actionButtons}
      <div className="flex grow flex-col gap-[1px] divide-y divide-gray-300 overflow-y-auto dark:divide-gray-900">
        {folders?.length > 0 && folderComponent}

        {filteredItems?.length > 0 ? (
          <div
            ref={dragDropElement}
            className={`min-h-[100px] min-w-[42px] grow ${
              isDraggingOver ? draggingColor : ''
            }`}
            onDrop={(e) => {
              setIsDraggingOver(false);
              handleDrop(e);
            }}
            onDragOver={allowDrop}
            onDragEnter={highlightDrop}
            onDragLeave={removeHighlight}
            data-qa="draggable-area"
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
    </Resizable>
  ) : null;
};

export default Sidebar;
