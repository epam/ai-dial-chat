import {
  DragEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { EnumMapper } from '@/src/utils/app/mappers';
import { isMediumScreen, isSmallScreen } from '@/src/utils/app/mobile';
import { hasDragEventEntityData } from '@/src/utils/app/move';
import { centralChatWidth, getNewSidebarWidth } from '@/src/utils/app/sidebar';

import { SidebarSide } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { SearchFilters } from '@/src/types/search';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import { CENTRAL_CHAT_MIN_WIDTH } from '@/src/constants/chat';
import {
  MOBILE_SIDEBAR_MIN_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from '@/src/constants/default-ui-settings';

import Loader from '../Common/Loader';
import { NoData } from '../Common/NoData';
import { NoResultsFound } from '../Common/NoResultsFound';
import Search from '../Search';
import { LeftSideResizeIcon, RightSideResizeIcon } from './ResizeIcons';

import trimEnd from 'lodash-es/trimEnd';
import { Resizable, ResizableProps, ResizeCallback } from 're-resizable';

interface Props<T> {
  isOpen: boolean;
  side: 'left' | 'right';
  filteredItems: T[];
  filteredFolders: FolderInterface[];
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
  areEntitiesUploaded: boolean;
}

const Sidebar = <T,>({
  isOpen,
  actionButtons,
  side,
  filteredItems,
  filteredFolders,
  itemComponent,
  folderComponent,
  footerComponent,
  searchTerm,
  searchFilters,
  featureType,
  handleSearchTerm,
  handleSearchFilters,
  handleDrop,
  areEntitiesUploaded,
}: Props<T>) => {
  const { t } = useTranslation(Translation.PromptBar);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragDropElement = useRef<HTMLDivElement>(null);
  const sideBarElementRef = useRef<Resizable>(null);
  const dispatch = useAppDispatch();

  const chatbarWidth = useAppSelector(UISelectors.selectChatbarWidth);
  const promptbarWidth = useAppSelector(UISelectors.selectPromptbarWidth);

  const isChatbarOpen = useAppSelector(UISelectors.selectShowChatbar);
  const isPromptbarOpen = useAppSelector(UISelectors.selectShowPromptbar);

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const [windowWidth, setWindowWidth] = useState<number | undefined>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
  });

  const sidebarMinWidth = isSmallScreen()
    ? MOBILE_SIDEBAR_MIN_WIDTH
    : SIDEBAR_MIN_WIDTH;

  const isLeftSidebar = side === SidebarSide.Left;
  const isRightSidebar = side === SidebarSide.Right;

  const dataQa = useMemo(
    () => (isLeftSidebar ? 'chatbar' : 'promptbar'),
    [isLeftSidebar],
  );

  const resizeTriggerClassName = classNames(
    'invisible h-full w-0.5 group-hover:visible md:visible xl:bg-accent-primary xl:text-accent-primary',
    isResizing
      ? 'bg-accent-primary text-accent-primary xl:visible'
      : 'bg-layer-3 text-secondary xl:invisible',
  );

  const sidebarWidth = useMemo(() => {
    if (windowWidth && isSmallScreen()) {
      return MOBILE_SIDEBAR_MIN_WIDTH;
    } else {
      return isLeftSidebar ? chatbarWidth : promptbarWidth;
    }
  }, [windowWidth, isLeftSidebar, chatbarWidth, promptbarWidth]);

  const centralChatMinWidth =
    windowWidth && isMediumScreen()
      ? windowWidth / 12 // windowWidth / 12 = 8% of the windowWidth
      : CENTRAL_CHAT_MIN_WIDTH; // fallback min width

  const oppositeSidebarMinWidth = useMemo(
    () =>
      (isLeftSidebar && isPromptbarOpen) || (!isLeftSidebar && isChatbarOpen)
        ? sidebarMinWidth
        : 0,
    [isChatbarOpen, isLeftSidebar, isPromptbarOpen, sidebarMinWidth],
  );

  const maxWidth = useMemo(() => {
    if (!windowWidth) return;
    return Math.round(
      getNewSidebarWidth({
        windowWidth,
        oppositeSidebarWidth: oppositeSidebarMinWidth,
        centralChatMinWidth,
      }),
    );
  }, [windowWidth, centralChatMinWidth, oppositeSidebarMinWidth]);

  const SIDEBAR_HEIGHT = 'auto';

  const allowDrop = useCallback(
    (e: DragEvent) => {
      if (hasDragEventEntityData(e, featureType)) {
        e.preventDefault();
      }
    },
    [featureType],
  );

  const highlightDrop = useCallback(
    (e: DragEvent) => {
      if (
        hasDragEventEntityData(e, featureType) &&
        (dragDropElement.current?.contains(e.target as Node) ||
          dragDropElement.current === e.target)
      ) {
        setIsDraggingOver(true);
      }
    },
    [featureType],
  );

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

  const onResize: ResizeCallback = useCallback(() => {
    if (!windowWidth) return;

    const sidebarCurrentWidth =
      sideBarElementRef.current?.resizable?.getClientRects()[0].width;
    const resizableWidth =
      sidebarCurrentWidth && Math.round(sidebarCurrentWidth);

    const width = resizableWidth ?? sidebarMinWidth;
    const sidebarAndCentralWidth = width + centralChatMinWidth;
    const maxOppositeSidebarWidth = windowWidth - sidebarAndCentralWidth;
    const maxSafeOppositeSidebarWidth =
      maxOppositeSidebarWidth > sidebarMinWidth
        ? maxOppositeSidebarWidth
        : sidebarMinWidth;

    if (!isMediumScreen()) {
      if (
        isLeftSidebar &&
        centralChatWidth({
          oppositeSidebarWidth: promptbarWidth,
          windowWidth,
          currentSidebarWidth: width,
        }) <= centralChatMinWidth
      ) {
        dispatch(UIActions.setPromptbarWidth(maxSafeOppositeSidebarWidth));
      }

      if (
        isRightSidebar &&
        centralChatWidth({
          oppositeSidebarWidth: chatbarWidth,
          windowWidth,
          currentSidebarWidth: width,
        }) <= centralChatMinWidth
      ) {
        dispatch(UIActions.setChatbarWidth(maxSafeOppositeSidebarWidth));
      }
    }
  }, [
    windowWidth,
    sidebarMinWidth,
    centralChatMinWidth,
    isLeftSidebar,
    promptbarWidth,
    isRightSidebar,
    chatbarWidth,
    dispatch,
  ]);

  const onResizeStop = useCallback(() => {
    setIsResizing(false);
    const resizableWidth =
      sideBarElementRef.current?.resizable?.getClientRects()[0].width &&
      Math.round(
        sideBarElementRef.current?.resizable?.getClientRects()[0].width,
      );

    const width = resizableWidth ?? sidebarMinWidth;

    if (isLeftSidebar) {
      dispatch(UIActions.setChatbarWidth(width));
    }

    if (isRightSidebar) {
      dispatch(UIActions.setPromptbarWidth(width));
    }
  }, [dispatch, isLeftSidebar, isRightSidebar, sidebarMinWidth]);

  const resizeSettings: ResizableProps = useMemo(() => {
    return {
      defaultSize: {
        width: sidebarWidth ?? sidebarMinWidth,
        height: SIDEBAR_HEIGHT,
      },
      minWidth: sidebarMinWidth,
      maxWidth,

      size: {
        width: sidebarWidth ?? sidebarMinWidth,
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
      onResize: onResize,
    };
  }, [
    sidebarWidth,
    sidebarMinWidth,
    maxWidth,
    isLeftSidebar,
    isRightSidebar,
    resizeTriggerClassName,
    onResizeStart,
    onResizeStop,
    onResize,
  ]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);

    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const resizableWrapperClassName = classNames(
    '!fixed z-40 flex max-w-[95%] border-tertiary md:max-w-[45%] xl:!relative xl:top-0 xl:!h-full',
    isLeftSidebar
      ? 'sidebar-left left-0 border-r'
      : 'sidebar-right right-0 border-l',
    isOverlay ? 'top-9 !h-[calc(100%-36px)]' : 'top-12 !h-[calc(100%-48px)]',
  );

  return isOpen ? (
    <Resizable
      ref={sideBarElementRef}
      {...resizeSettings}
      className={resizableWrapperClassName}
      data-qa={dataQa}
    >
      <div className="group/sidebar flex size-full flex-none shrink-0 flex-col divide-y divide-tertiary bg-layer-3 transition-all">
        {areEntitiesUploaded ? (
          <>
            <Search
              placeholder={t('Search {{name}}...', {
                name: trimEnd(
                  EnumMapper.getApiKeyByFeatureType(featureType),
                  's',
                ),
              })}
              searchTerm={searchTerm}
              searchFilters={searchFilters}
              onSearch={handleSearchTerm}
              onSearchFiltersChanged={handleSearchFilters}
              featureType={featureType}
            />

            {actionButtons}

            <div className="flex grow flex-col gap-px divide-y divide-tertiary overflow-y-auto">
              {folderComponent}

              {filteredItems.length > 0 || filteredFolders.length > 0 ? (
                <div
                  ref={dragDropElement}
                  className={classNames(
                    'min-h-min min-w-[42px] grow',
                    isDraggingOver && 'bg-accent-primary-alpha',
                  )}
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
          </>
        ) : (
          <Loader />
        )}
      </div>
    </Resizable>
  ) : null;
};

export default Sidebar;
