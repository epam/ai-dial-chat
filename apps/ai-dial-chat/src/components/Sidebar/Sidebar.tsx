import {
  DragEvent,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { FeatureType } from '@/src/types/common';
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
  handleDrop: (e: DragEvent<HTMLDivElement>) => void;
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

  const resizeTriggerColor = classNames(
    'xl:bg-accent-primary xl:text-accent-primary',
    isResizing ? 'bg-accent-primary text-accent-primary' : '',
  );

  const resizeTriggerClassName = classNames(
    'invisible h-full w-0.5 bg-layer-3 text-secondary group-hover:visible md:visible',
    resizeTriggerColor,
    isResizing ? 'xl:visible' : 'xl:invisible',
  );

  const SIDEBAR_DEFAULT_WIDTH = useMemo(
    () => (isLeftSidebar ? chatbarWidth : promptbarWidth),
    [isLeftSidebar, chatbarWidth, promptbarWidth],
  );
  const SIDEBAR_HEIGHT = 'auto';

  const allowDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
  }, []);

  const highlightDrop = useCallback((e: DragEvent) => {
    if (
      dragDropElement.current?.contains(e.target as Node) ||
      dragDropElement.current === e.target
    ) {
      setIsDraggingOver(true);
    }
  }, []);

  const removeHighlight = useCallback((e: DragEvent) => {
    if (
      (e.target === dragDropElement.current ||
        dragDropElement.current?.contains(e.target as Node)) &&
      !dragDropElement.current?.contains(e.relatedTarget as Node)
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
    `!fixed top-12 z-40 flex !h-[calc(100%-48px)] min-w-[260px] border-tertiary md:max-w-[45%] xl:!relative xl:top-0 xl:!h-full`,
    isLeftSidebar
      ? 'sidebar-left left-0 border-r'
      : 'sidebar-right right-0 border-l',
  );

  return isOpen ? (
    <Resizable
      ref={sideBarElementRef}
      {...resizeSettings}
      className={resizableWrapperClassName}
      data-qa={dataQa}
    >
      <div className="group/sidebar flex size-full flex-none shrink-0 flex-col divide-y divide-tertiary bg-layer-3 transition-all">
        <Search
          placeholder={t('Search {{name}}...', { name: featureType })}
          searchTerm={searchTerm}
          searchFilters={searchFilters}
          onSearch={handleSearchTerm}
          onSearchFiltersChanged={handleSearchFilters}
          featureType={featureType}
        />

        {actionButtons}

        <div className="flex grow flex-col gap-px divide-y divide-tertiary overflow-y-auto">
          {folderComponent}

          {filteredItems?.length > 0 ? (
            <div
              ref={dragDropElement}
              className={`min-h-[100px] min-w-[42px] grow ${
                isDraggingOver ? 'bg-accent-primary-alpha' : ''
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
