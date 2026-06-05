import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconRefresh,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';
import { useVisualizerAuthLayoutFields } from '@/src/hooks/useVisualizerAuthLayoutFields';
import { useVisualizerLocaleLayoutFields } from '@/src/hooks/useVisualizerLocaleLayoutFields';
import { useWindowResizeEvent } from '@/src/hooks/useWindowResizeEvent';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { ApplicationVisualizerConfig } from '@/src/types/custom-visualizers';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import {
  DEFAULT_CUSTOM_ATTACHMENT_HEIGHT,
  DEFAULT_CUSTOM_ATTACHMENT_MOBILE_HEIGHT,
  DEFAULT_CUSTOM_ATTACHMENT_WIDTH,
} from '@/src/constants/chat';
import { ChatI18nKeys } from '@/src/constants/i18n';

import { Spinner } from '@/src/components/Common/Spinner';

import {
  AttachmentItem,
  CustomVisualizerData,
  CustomVisualizerDataLayout,
  GroupedAttachmentsData,
  Role,
  VisualizerConnectorEvents,
  VisualizerConnectorRequest,
  VisualizerConnectorRequests,
} from '@epam/ai-dial-shared';
import { DialLinkButton } from '@epam/ai-dial-ui-kit';
import { VisualizerConnector } from '@epam/ai-dial-visualizer-connector';

interface AttachmentInfo {
  url: string;
  mimeType: string;
}

interface Props {
  attachments: AttachmentInfo[];
  visualizerConfig: ApplicationVisualizerConfig;
  forceDefaultView?: boolean;
}

function getLoadedLayoutsForAttachments(
  attachments: AttachmentInfo[],
  loadedCustomAttachmentsData: { url: string; data: CustomVisualizerData }[],
): CustomVisualizerDataLayout[] {
  return attachments
    .map(
      ({ url }) =>
        loadedCustomAttachmentsData.find((d) => d.url === url)?.data?.layout,
    )
    .filter((layout): layout is CustomVisualizerDataLayout => layout != null);
}

function maxLayoutMetric(
  layouts: CustomVisualizerDataLayout[],
  read: (layout: CustomVisualizerDataLayout) => number | undefined,
  fallback: number,
): number {
  if (!layouts.length) return fallback;
  return Math.max(
    ...layouts.map((layout) => {
      const value = Number(read(layout));
      return Number.isFinite(value) ? value : fallback;
    }),
  );
}

export const GroupedVisualizerRenderer = ({
  attachments,
  visualizerConfig,
  forceDefaultView,
}: Props) => {
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const visualizer = useRef<VisualizerConnector | null>(null);
  const { t } = useTranslation(Translation.Chat);

  const [ready, setReady] = useState<boolean>();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isScreenSmall, setIsScreenSmall] = useState(isSmallScreen());

  const handleResize = useCallback(() => {
    setIsScreenSmall(isSmallScreen());
  }, []);
  useWindowResizeEvent(handleResize);

  const {
    url: rendererUrl,
    title: visualizerTitle = 'Visualizer',
    passAuthInfo,
    passExplicitToken,
    withoutTitle: configWithoutTitle,
    borderless: configBorderless,
  } = visualizerConfig;

  const dispatch = useAppDispatch();

  const themeId = useAppSelector(UISelectors.selectThemeState);

  const localeLayoutFields = useVisualizerLocaleLayoutFields();
  const authLayoutFields = useVisualizerAuthLayoutFields({
    passAuthInfo,
    passExplicitToken,
  });

  const loadedCustomAttachmentsData = useAppSelector(
    ConversationsSelectors.selectLoadedCustomAttachments,
  );

  const currentConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );

  const isAllowedSendMessage = useAppSelector(
    SettingsSelectors.selectAllowVisualizerSendMessages,
  );

  const hideTitle = !!configWithoutTitle && !forceDefaultView;
  const isBorderless = !!configBorderless && !forceDefaultView;

  const scrollWidth = iframeContainerRef.current?.scrollWidth ?? null;
  const containerHeight = iframeContainerRef.current?.clientHeight ?? null;

  useEffect(() => {
    attachments.forEach(({ url }) => {
      const isLoaded = loadedCustomAttachmentsData.some(
        (data) => data.url === url,
      );
      if (!isLoaded) {
        dispatch(
          ConversationsActions.getCustomAttachmentData({
            pathToAttachment: url,
          }),
        );
      }
    });
  }, [attachments, loadedCustomAttachmentsData, dispatch]);

  const allAttachmentsLoaded = useMemo(() => {
    return attachments.every(({ url }) =>
      loadedCustomAttachmentsData.some((data) => data.url === url),
    );
  }, [attachments, loadedCustomAttachmentsData]);

  const groupedVisualizerLayout: CustomVisualizerDataLayout = useMemo(() => {
    const attachmentLayouts = getLoadedLayoutsForAttachments(
      attachments,
      loadedCustomAttachmentsData,
    );
    const referenceLayout = attachmentLayouts[0];

    const maxWidth = maxLayoutMetric(
      attachmentLayouts,
      (layout) => layout.width,
      DEFAULT_CUSTOM_ATTACHMENT_WIDTH,
    );
    const maxHeight = maxLayoutMetric(
      attachmentLayouts,
      (layout) => layout.height,
      DEFAULT_CUSTOM_ATTACHMENT_HEIGHT,
    );
    const maxMobileHeight = attachmentLayouts.length
      ? Math.max(
          ...attachmentLayouts.map((layout) =>
            Number(
              layout.mobileHeight ?? DEFAULT_CUSTOM_ATTACHMENT_MOBILE_HEIGHT,
            ),
          ),
        )
      : DEFAULT_CUSTOM_ATTACHMENT_MOBILE_HEIGHT;

    return {
      ...referenceLayout,
      width: scrollWidth ? scrollWidth : maxWidth,
      height: isFullScreen && containerHeight ? containerHeight : maxHeight,
      mobileHeight: maxMobileHeight,
      themeId,
      ...authLayoutFields,
      ...localeLayoutFields,
    };
  }, [
    attachments,
    loadedCustomAttachmentsData,
    authLayoutFields,
    localeLayoutFields,
    scrollWidth,
    containerHeight,
    isFullScreen,
    themeId,
  ]);

  const groupedAttachmentsData: GroupedAttachmentsData | null = useMemo(() => {
    if (!allAttachmentsLoaded) return null;

    const attachmentItems: AttachmentItem[] = attachments.map(
      ({ url, mimeType }) => {
        const data = loadedCustomAttachmentsData.find((d) => d.url === url);
        return {
          url,
          mimeType,
          contentType: mimeType,
          visualizerData: data!.data,
        };
      },
    );

    return {
      attachments: attachmentItems,
      layout: groupedVisualizerLayout,
    };
  }, [
    allAttachmentsLoaded,
    attachments,
    loadedCustomAttachmentsData,
    groupedVisualizerLayout,
  ]);

  const sendMessage = useCallback(
    async (visualizerInstance: VisualizerConnector) => {
      if (groupedAttachmentsData) {
        await visualizerInstance.send(
          VisualizerConnectorRequests.sendGroupedVisualizeData,
          groupedAttachmentsData,
        );
      }
    },
    [groupedAttachmentsData],
  );

  useEffect(() => {
    if (iframeContainerRef.current && !visualizer.current) {
      visualizer.current = new VisualizerConnector(iframeContainerRef.current, {
        domain: rendererUrl,
        hostDomain: window.location.origin,
        visualizerName: visualizerTitle,
        loaderStyles: { display: 'none' },
      });

      return () => {
        visualizer.current?.destroy();
        visualizer.current = null;
      };
    }
  }, [rendererUrl, visualizerTitle]);

  useEffect(() => {
    if (
      ready &&
      !!visualizer.current &&
      groupedAttachmentsData &&
      iframeContainerRef.current
    ) {
      sendMessage(visualizer.current);
    }
  }, [ready, sendMessage, groupedAttachmentsData]);

  useEffect(() => {
    const postMessageListener = (
      event: MessageEvent<VisualizerConnectorRequest>,
    ) => {
      if (!rendererUrl.startsWith(event.origin)) return;

      if (
        event.data.type ===
        `${visualizerTitle}/${VisualizerConnectorEvents.readyToInteract}`
      ) {
        setReady(true);
      }

      if (
        isAllowedSendMessage &&
        event.data.type ===
          `${visualizerTitle}/${VisualizerConnectorEvents.sendMessage}` &&
        event.data.payload &&
        typeof event.data.payload === 'object' &&
        Object.prototype.hasOwnProperty.call(event.data.payload, 'message')
      ) {
        const content = (event.data.payload as { message: string }).message;
        dispatch(
          ConversationsActions.sendMessages({
            conversations: currentConversations,
            deleteCount: 0,
            message: {
              role: Role.User,
              content,
            },
            activeReplayIndex: 0,
          }),
        );
      }
    };

    window.addEventListener('message', postMessageListener, false);

    return () => window.removeEventListener('message', postMessageListener);
  }, [
    visualizerTitle,
    rendererUrl,
    dispatch,
    currentConversations,
    isAllowedSendMessage,
  ]);

  const handleToggleFullScreen = useCallback(() => {
    setIsFullScreen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isFullScreen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsFullScreen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isFullScreen]);

  const FullScreenIcon = useMemo(
    () => (isFullScreen ? IconArrowsMinimize : IconArrowsMaximize),
    [isFullScreen],
  );

  if (!attachments.length) {
    return null;
  }

  const iframeContainerHeight = !isFullScreen
    ? isScreenSmall
      ? groupedVisualizerLayout.mobileHeight
      : groupedVisualizerLayout.height
    : undefined;

  return (
    <div
      data-no-context-menu
      className={classNames(
        isFullScreen && 'fixed left-0 top-0 z-[9999] size-full bg-layer-3',
        isFullScreen && isBorderless && '!bg-layer-1',
      )}
    >
      <div
        className={classNames(
          isFullScreen && 'size-full p-2',
          !isFullScreen && 'mb-3',
        )}
      >
        <div className="mb-2 flex flex-row justify-between">
          {!hideTitle ? <h2>{visualizerTitle}</h2> : <div />}

          <div className="flex items-center justify-end gap-2">
            <DialLinkButton
              className="flex text-accent-primary"
              onClick={() =>
                visualizer.current && sendMessage(visualizer.current)
              }
              iconBefore={<IconRefresh size={18} />}
              label={t(ChatI18nKeys.Refresh)}
            />

            {isBorderless && (
              <DialLinkButton
                className="text-secondary hover:text-accent-primary"
                iconBefore={<FullScreenIcon size={18} />}
                onClick={handleToggleFullScreen}
              />
            )}
          </div>
        </div>
        <div
          ref={iframeContainerRef}
          className={classNames(
            'size-full',
            isFullScreen && 'h-[calc(100%-30px)]',
          )}
          style={{
            height: iframeContainerHeight,
          }}
        >
          {(!ready || !allAttachmentsLoaded) && (
            <div className="absolute z-10 flex size-full items-center bg-layer-1">
              <Spinner className="mx-auto" size={30} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
