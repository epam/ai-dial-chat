import {
  DragEvent,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';
import { useWindowResizeEvent } from '@/src/hooks/useWindowResizeEvent';

import { EnumMapper } from '@/src/utils/app/mappers';
import { isSmallScreen, isTabletScreen } from '@/src/utils/app/mobile';
import { hasDragEventEntityData } from '@/src/utils/app/move';
import { centralChatWidth, getNewSidebarWidth } from '@/src/utils/app/sidebar';

import { SidebarSide } from '@/src/types/chat';
import { FeatureType, ScreenState } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { SearchFilters } from '@/src/types/search';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';
import { UIActions } from '@/src/store/ui/ui.reducers';
import { UISelectors } from '@/src/store/ui/ui.selectors';

import { CENTRAL_CHAT_MIN_WIDTH } from '@/src/constants/chat';
import {
  MOBILE_SIDEBAR_MIN_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from '@/src/constants/default-ui-settings';

import { CloseSidebarButton } from '../Buttons/CloseSidebarButton';
import Loader from '../Common/Loader';
import { NoData } from '../Common/NoData';
import { NoResultsFound } from '../Common/NoResultsFound';
import {
  CreateNewConversation,
  CreateNewPrompt,
} from '../Header/CreateNewEntity';
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
  footerComponent?: ReactNode;
  searchTerm: string;
  searchFilters: SearchFilters;
  featureType: FeatureType;
  onSearchTerm: (searchTerm: string) => void;
  onSearchFilters: (searchFilters: SearchFilters) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  toggleOpen?: () => void;
  areEntitiesUploaded: boolean;
}

const Sidebar = <T,>({
  isOpen,
  side,
  filteredItems,
  filteredFolders,
  itemComponent,
  folderComponent,
  footerComponent,
  searchTerm,
  searchFilters,
  featureType,
  onSearchTerm,
  onSearchFilters,
  onDrop,
  areEntitiesUploaded,
}: Props<T>) => {
  const { t } = useTranslation(Translation.PromptBar);

  const dispatch = useAppDispatch();

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const dragDropElement = useRef<HTMLDivElement>(null);
  const sideBarElementRef = useRef<Resizable>(null);

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

  const screenState = useScreenState();

  const sidebarMinWidth =
    screenState === ScreenState.SM
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
    windowWidth && isTabletScreen()
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

    if (!isTabletScreen()) {
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

  const handleClose = () => {
    if (isLeftSidebar) {
      dispatch(UIActions.setShowChatbar(false));
    } else {
      dispatch(UIActions.setShowPromptbar(false));
    }
  };

  const handleResize = useCallback(() => {
    setWindowWidth(window.innerWidth);
  }, []);
  useWindowResizeEvent(handleResize);

  const resizableWrapperClassName = classNames(
    '!fixed z-40 flex max-w-[95%] border-tertiary md:max-w-[45%] xl:!relative xl:top-0 xl:!h-full',
    isLeftSidebar
      ? 'sidebar-left left-0 border-r xl:left-0'
      : 'sidebar-right right-0 border-l',
    isLeftSidebar && (isOverlay ? 'md:left-[44px]' : 'md:left-[60px]'),
    (screenState === ScreenState.SM || screenState === ScreenState.MD) &&
      '!h-full',
    screenState !== ScreenState.SM &&
      screenState !== ScreenState.MD &&
      (isOverlay
        ? 'top-9 !h-[calc(100%-36px)]'
        : 'top-12 !h-[calc(100%-48px)]'),
  );

  if (!isOpen) {
    return null;
  }

  const createIconSize = isOverlay ? 18 : 24;

  return (
    <Resizable
      ref={sideBarElementRef}
      {...resizeSettings}
      className={resizableWrapperClassName}
      data-qa={dataQa}
    >
      <CloseSidebarButton isLeftSide={isLeftSidebar} onClose={handleClose} />
      <div className="group/sidebar flex size-full flex-none shrink-0 flex-col divide-y divide-tertiary bg-layer-3 transition-all">
        {areEntitiesUploaded ? (
          <>
            <div
              className={classNames(
                'flex  items-center justify-between px-5',
                isOverlay ? 'min-h-[35px]' : 'min-h-12',
              )}
            >
              <p className="text-base font-semibold">
                {t(isLeftSidebar ? 'Conversations' : 'Prompts')}
              </p>
              {isLeftSidebar ? (
                <CreateNewConversation iconSize={createIconSize} />
              ) : (
                <CreateNewPrompt iconSize={createIconSize} />
              )}
            </div>
            <Search
              placeholder={t('Search {{name}}...', {
                name: trimEnd(
                  EnumMapper.getApiKeyByFeatureType(featureType),
                  's',
                ),
              })}
              searchTerm={searchTerm}
              searchFilters={searchFilters}
              onSearch={onSearchTerm}
              onSearchFiltersChanged={onSearchFilters}
              featureType={featureType}
            />

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
                    onDrop(e);
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
  );
};

export default Sidebar;
