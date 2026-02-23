import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconRefresh,
} from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

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
  DEFAULT_CUSTOM_ATTACHMENT_WIDTH,
} from '@/src/constants/chat';

import { Spinner } from '@/src/components/Common/Spinner';

import {
  AttachmentItem,
  CustomVisualizerDataLayout,
  GroupedAttachmentsData,
  Role,
  VisualizerConnectorEvents,
  VisualizerConnectorRequest,
  VisualizerConnectorRequests,
} from '@epam/ai-dial-shared';
import {
  ButtonAppearance,
  DialButton,
  DialLinkButton,
} from '@epam/ai-dial-ui-kit';
import { VisualizerConnector } from '@epam/ai-dial-visualizer-connector';

interface AttachmentInfo {
  url: string;
  mimeType: string;
}

interface Props {
  attachments: AttachmentInfo[];
  visualizerConfig: ApplicationVisualizerConfig;
  isFullScreen?: boolean;
  forceDefaultView?: boolean;
  onFullScreenClick?: () => void;
}

export const GroupedVisualizerRenderer = ({
  attachments,
  visualizerConfig,
  isFullScreen,
  forceDefaultView,
  onFullScreenClick,
}: Props) => {
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const visualizer = useRef<VisualizerConnector | null>(null);
  const { t } = useTranslation(Translation.Chat);

  const [ready, setReady] = useState<boolean>();
  const { data: session } = useSession();
  const {
    url: rendererUrl,
    title: visualizerTitle = 'Visualizer',
    isAuth,
  } = visualizerConfig;

  const dispatch = useAppDispatch();

  const attachmentDataLoading = useAppSelector(
    ConversationsSelectors.selectCustomAttachmentLoading,
  );

  const themeId = useAppSelector(UISelectors.selectThemeState);

  const authLayoutFields = useMemo((): Partial<CustomVisualizerDataLayout> => {
    if (!isAuth || !session) return {};
    const email = session.user?.email ?? undefined;
    const providerId = (session as { providerId?: string }).providerId;
    return {
      ...(email != null && { logInHint: email }),
      ...(providerId != null && { providerId }),
    };
  }, [isAuth, session]);

  const loadedCustomAttachmentsData = useAppSelector(
    ConversationsSelectors.selectLoadedCustomAttachmentsData,
  );

  const currentConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );

  const isAllowedSendMessage = useAppSelector(
    SettingsSelectors.selectAllowVisualizerSendMessages,
  );

  const { withoutTitleTypes, borderlessTypes } = useAppSelector(
    SettingsSelectors.selectAttachmentsSettings,
  );

  const hideTitle =
    attachments.some((a) => withoutTitleTypes.includes(a.mimeType)) &&
    !forceDefaultView;
  const isBorderless =
    attachments.some((a) => borderlessTypes.includes(a.mimeType)) &&
    !forceDefaultView;

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

    const layout: CustomVisualizerDataLayout = {
      width: scrollWidth ?? DEFAULT_CUSTOM_ATTACHMENT_WIDTH,
      height:
        isFullScreen && containerHeight
          ? containerHeight
          : DEFAULT_CUSTOM_ATTACHMENT_HEIGHT,
      themeId,
      ...authLayoutFields,
    };

    return {
      attachments: attachmentItems,
      layout,
    };
  }, [
    allAttachmentsLoaded,
    attachments,
    loadedCustomAttachmentsData,
    authLayoutFields,
    scrollWidth,
    containerHeight,
    isFullScreen,
    themeId,
  ]);

  const sendMessage = useCallback(
    async (visualizerInstance: VisualizerConnector) => {
      await visualizerInstance.ready();

      if (groupedAttachmentsData) {
        visualizerInstance.send(
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

  const FullScreenIcon = useMemo(
    () => (isFullScreen ? IconArrowsMinimize : IconArrowsMaximize),
    [isFullScreen],
  );

  if (!attachments.length) {
    return null;
  }

  const iframeContainerClassNames = isFullScreen
    ? 'h-[calc(100%-30px)]'
    : `h-[${groupedAttachmentsData?.layout.height ?? DEFAULT_CUSTOM_ATTACHMENT_HEIGHT}px]`;

  return (
    <div className={classNames(isFullScreen && 'size-full p-2')}>
      <div className="mb-2 flex flex-row justify-between">
        {!hideTitle ? <h2>{visualizerTitle}</h2> : <div />}

        <div className="flex items-center justify-end gap-2">
          <DialLinkButton
            className="flex text-accent-primary"
            onClick={() =>
              visualizer.current && sendMessage(visualizer.current)
            }
            iconBefore={<IconRefresh size={18} />}
            label={t('Refresh')}
          />

          {isBorderless && (
            <DialButton
              className="text-secondary hover:text-accent-primary"
              iconBefore={<FullScreenIcon size={18} />}
              onClick={onFullScreenClick}
              appearance={ButtonAppearance.Link}
            />
          )}
        </div>
      </div>
      <div
        ref={iframeContainerRef}
        className={classNames('size-full', iframeContainerClassNames)}
      >
        {(!ready || attachmentDataLoading || !allAttachmentsLoaded) && (
          <div className="absolute z-10 flex size-full items-center bg-layer-1">
            <Spinner className="mx-auto" size={30} />
          </div>
        )}
      </div>
    </div>
  );
};
