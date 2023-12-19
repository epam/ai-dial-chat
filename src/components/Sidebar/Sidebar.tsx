import { ReactNode, useCallback, useMemo, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getByHighlightColor } from '@/src/utils/app/folders';

import { FeatureType, HighlightColor } from '@/src/types/common';
import { SearchFilters } from '@/src/types/search';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import { SIDEBAR_MIN_WIDTH } from '@/src/constants/default-ui-settings';

import { NoData } from '../Common/NoData';
import { NoResultsFound } from '../Common/NoResultsFound';
import Search from '../Search';
import { LeftSideResizeIcon, RightSideResizeIcon } from './ResizeIcons';

import { Resizable, ResizableProps } from 're-resizable';

interface Props<T> {
  isOpen: boolean;
  side: 'left' | 'right';
  filteredItems: T[];
  itemComponent: ReactNode;
  folderComponent: ReactNode;
  actionButtons: ReactNode;
  footerComponent?: ReactNode;
  searchTerm: string;
  searchFilters: SearchFilters;
  featureType: FeatureType;
  handleSearchTerm: (searchTerm: string) => void;
  handleSearchFilters: (searchFilters: SearchFilters) => void;
  toggleOpen?: () => void;
  handleDrop: (e: any) => void;
}

const Sidebar = <T,>({
  isOpen,
  actionButtons,
  side,
  filteredItems,
  itemComponent,
  folderComponent,
  footerComponent,
  searchTerm,
  searchFilters,
  featureType,
  handleSearchTerm,
  handleSearchFilters,
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
  const highlightColor = isLeftSidebar
    ? HighlightColor.Green
    : HighlightColor.Violet;
  const draggingColor = getByHighlightColor(
    highlightColor,
    'bg-green/15',
    'bg-violet/15',
  );

  const chatbarColor = classNames(
    'xl:bg-green xl:text-green xl:dark:bg-green',
    isResizing ? 'bg-green text-green dark:bg-green' : '',
  );

  const promptbarColor = classNames(
    'xl:bg-violet xl:text-violet xl:dark:bg-violet',
    isResizing ? 'bg-violet text-violet dark:bg-violet' : '',
  );

  const resizeTriggerColor = getByHighlightColor(
    highlightColor,
    chatbarColor,
    promptbarColor,
  );

  const resizeTriggerClassName = classNames(
    'invisible h-full w-0.5 bg-gray-500 text-gray-500 group-hover:visible dark:bg-gray-600  md:visible',
    resizeTriggerColor,
    isResizing ? 'xl:visible' : 'xl:invisible',
  );

  const SIDEBAR_DEFAULT_WIDTH = useMemo(
    () => (isLeftSidebar ? chatbarWidth : promptbarWidth),
    [isLeftSidebar, chatbarWidth, promptbarWidth],
  );
  const SIDEBAR_HEIGHT = 'auto';

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
      handleStyles: { right: { right: '-11px' }, left: { left: '-3px' } },
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

  const resizableWrapperClassName = classNames(
    `!fixed top-12 z-40 flex !h-[calc(100%-48px)] min-w-[260px] border-gray-300 dark:border-gray-900 md:max-w-[45%] xl:!relative xl:top-0 xl:!h-full`,
    isLeftSidebar ? 'left-0 border-r' : 'right-0 border-l',
  );

  return isOpen ? (
    <Resizable
      ref={sideBarElementRef}
      {...resizeSettings}
      className={resizableWrapperClassName}
      data-qa={dataQa}
    >
      <div className="group/sidebar flex h-full w-full flex-none shrink-0 flex-col divide-y divide-gray-300 bg-gray-100 transition-all dark:divide-gray-900 dark:bg-gray-700">
        <Search
          placeholder={t('Search {{name}}...', { name: featureType })}
          searchTerm={searchTerm}
          searchFilters={searchFilters}
          onSearch={handleSearchTerm}
          onSearchFiltersChanged={handleSearchFilters}
          featureType={featureType}
        />

        {actionButtons}

        <div className="flex grow flex-col gap-px divide-y divide-gray-300 overflow-y-auto dark:divide-gray-900">
          {folderComponent}

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
          ) : searchTerm.length ? (
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
    </Resizable>
  ) : null;
};

export default Sidebar;
