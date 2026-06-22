import React, { useCallback, useMemo, useRef, useState } from 'react';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useWindowResizeEvent } from '@/src/hooks/useWindowResizeEvent';

import { isSmallScreen, isTabletScreen } from '@/src/utils/app/mobile';
import { isRtlLocale } from '@/src/utils/app/rtl';
import { centralChatWidth, getNewSidebarWidth } from '@/src/utils/app/sidebar';

import { ScreenState } from '@/src/types/common';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';
import { UIActions } from '@/src/store/ui/ui.reducers';
import { UISelectors } from '@/src/store/ui/ui.selectors';

import { CENTRAL_CHAT_MIN_WIDTH } from '@/src/constants/chat';
import {
  MOBILE_SIDEBAR_MIN_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from '@/src/constants/default-ui-settings';
import { Routes } from '@/src/constants/routes';

import { CloseSidebarButton } from '@/src/components/Buttons/CloseSidebarButton';

import { LeftSideResizeIcon, RightSideResizeIcon } from './ResizeIcons';

import { Resizable, ResizableProps, ResizeCallback } from 're-resizable';

interface Props {
  children: React.ReactNode;
  dataQa: string;
  isLeftSidebar: boolean;
  handleClose: () => void;
}

const SIDEBAR_HEIGHT = 'auto';

export function ResizableSidebarWrapper({
  children,
  dataQa,
  isLeftSidebar,
  handleClose,
}: Props) {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const sideBarElementRef = useRef<Resizable>(null);

  const chatbarWidth = useAppSelector(UISelectors.selectChatbarWidth);
  const promptbarWidth = useAppSelector(UISelectors.selectPromptbarWidth);
  const marketplaceFilterbarWidth = useAppSelector(
    UISelectors.selectMarketplaceFilterbarWidth,
  );
  const isChatbarOpen = useAppSelector(UISelectors.selectShowChatbar);
  const isPromptbarOpen = useAppSelector(UISelectors.selectShowPromptbar);
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const isMdSidebarOverlayBreakpoint = useAppSelector(
    SettingsSelectors.selectIsMdSidebarOverlayBreakpoint,
  );
  const isNavigationVisible = useAppSelector(
    UISelectors.selectIsNavigationVisible,
  );

  const isMarketplaceFilterbar =
    isLeftSidebar && router.route === Routes.Marketplace;

  const isRtl = isRtlLocale(router.locale ?? 'en');
  const isPhysicallyLeftSidebar = isRtl ? !isLeftSidebar : isLeftSidebar;

  const [windowWidth, setWindowWidth] = useState<number | undefined>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
  });
  const [isResizing, setIsResizing] = useState(false);

  const screenState = useScreenState();

  const sidebarMinWidth =
    screenState === ScreenState.SM
      ? MOBILE_SIDEBAR_MIN_WIDTH
      : SIDEBAR_MIN_WIDTH;

  const resizeTriggerClassName = classNames(
    'invisible h-full w-0.5 group-hover:visible md:visible',
    isMdSidebarOverlayBreakpoint
      ? 'sidebar-overlay-md:bg-accent-primary sidebar-overlay-md:text-accent-primary'
      : 'sidebar-overlay:bg-accent-primary sidebar-overlay:text-accent-primary',
    isResizing
      ? classNames(
          'bg-accent-primary text-accent-primary',
          isMdSidebarOverlayBreakpoint
            ? 'sidebar-overlay-md:visible'
            : 'sidebar-overlay:visible',
        )
      : classNames(
          'bg-layer-3 text-secondary',
          isMdSidebarOverlayBreakpoint
            ? 'sidebar-overlay-md:invisible'
            : 'sidebar-overlay:invisible',
        ),
  );

  const sidebarWidth = useMemo(() => {
    if (windowWidth && isSmallScreen()) {
      return MOBILE_SIDEBAR_MIN_WIDTH;
    } else {
      return isLeftSidebar
        ? isMarketplaceFilterbar
          ? marketplaceFilterbarWidth
          : chatbarWidth
        : promptbarWidth;
    }
  }, [
    windowWidth,
    isLeftSidebar,
    chatbarWidth,
    promptbarWidth,
    marketplaceFilterbarWidth,
    isMarketplaceFilterbar,
  ]);

  const centralChatMinWidth =
    windowWidth && isTabletScreen()
      ? 104 // widget panel width + close button width
      : CENTRAL_CHAT_MIN_WIDTH; // fallback min width

  const oppositeSidebarMinWidth = useMemo(
    () =>
      (isLeftSidebar && isPromptbarOpen) || (!isLeftSidebar && isChatbarOpen)
        ? sidebarMinWidth
        : 0,
    [isChatbarOpen, isLeftSidebar, isPromptbarOpen, sidebarMinWidth],
  );

  const handleResize = useCallback(() => {
    setWindowWidth(window.innerWidth);
  }, []);
  useWindowResizeEvent(handleResize);

  const onResizeStart = useCallback(() => {
    setIsResizing(true);
  }, []);

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

  const onResize: ResizeCallback = useCallback(() => {
    if (!windowWidth || isMarketplaceFilterbar) return;

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
        !isLeftSidebar &&
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
    chatbarWidth,
    dispatch,
    isMarketplaceFilterbar,
  ]);

  const onResizeStop = useCallback(() => {
    setIsResizing(false);
    const resizableWidth =
      sideBarElementRef.current?.resizable?.getClientRects()[0].width &&
      Math.round(
        sideBarElementRef.current?.resizable?.getClientRects()[0].width,
      );

    const width = resizableWidth ?? sidebarMinWidth;

    if (isMarketplaceFilterbar) {
      dispatch(UIActions.setMarketplaceFilterbarWidth(width));
      return;
    }

    if (isLeftSidebar) {
      dispatch(UIActions.setChatbarWidth(width));
    }

    if (!isLeftSidebar) {
      dispatch(UIActions.setPromptbarWidth(width));
    }
  }, [dispatch, isLeftSidebar, isMarketplaceFilterbar, sidebarMinWidth]);

  const sidebarThemeClassname = isMarketplaceFilterbar
    ? undefined
    : isLeftSidebar
      ? 'sidebar-left'
      : 'sidebar-right';

  const resizableWrapperClassName = classNames(
    '!fixed z-40 flex !h-full max-w-[95%] border-tertiary md:max-w-[45%]',
    isMdSidebarOverlayBreakpoint
      ? 'sidebar-overlay-md:!relative sidebar-overlay-md:top-0'
      : 'sidebar-overlay:!relative sidebar-overlay:top-0',
    isLeftSidebar
      ? classNames(
          'start-0 border-r',
          isMdSidebarOverlayBreakpoint
            ? 'sidebar-overlay-md:start-0'
            : 'sidebar-overlay:start-0',
        )
      : 'end-0 border-l',
    sidebarThemeClassname,
    isLeftSidebar &&
      isNavigationVisible &&
      (isOverlay ? 'md:start-[44px]' : 'md:start-[60px]'),
  );

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
        right: isPhysicallyLeftSidebar,
        bottom: false,
        left: !isPhysicallyLeftSidebar,
        topRight: false,
        bottomRight: false,
        bottomLeft: false,
        topLeft: false,
      },
      handleClasses: {
        right: 'group invisible md:visible',
        left: 'group invisible md:visible',
      },
      handleStyles: {
        right: { right: isRtl ? '-3px' : '-11px' },
        left: { left: isRtl ? '-11px' : '-3px' },
      },
      handleComponent: {
        left: <LeftSideResizeIcon className={resizeTriggerClassName} />,
        right: (
          <RightSideResizeIcon
            className={classNames(
              resizeTriggerClassName,
              isRtl && '[&>svg]:-mr-6',
            )}
          />
        ),
      },
      onResizeStart: onResizeStart,
      onResizeStop: onResizeStop,
      onResize: onResize,
    };
  }, [
    sidebarWidth,
    sidebarMinWidth,
    maxWidth,
    isRtl,
    isPhysicallyLeftSidebar,
    resizeTriggerClassName,
    onResizeStart,
    onResizeStop,
    onResize,
  ]);

  return (
    <Resizable
      ref={sideBarElementRef}
      {...resizeSettings}
      className={resizableWrapperClassName}
      data-qa={dataQa}
    >
      <CloseSidebarButton isLeftSide={isLeftSidebar} onClose={handleClose} />
      <div className="group/sidebar flex size-full flex-none shrink-0 flex-col divide-y divide-tertiary bg-layer-3 transition-all">
        {children}
      </div>
    </Resizable>
  );
}
