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

import { CustomVisualizer } from '@/src/types/custom-visualizers';
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
import { ChatI18nKeys } from '@/src/constants/i18n';

import { Spinner } from '@/src/components/Common/Spinner';

import {
  AttachmentData,
  CustomVisualizerDataLayout,
  Role,
  VisualizerConnectorEvents,
  VisualizerConnectorRequest,
  VisualizerConnectorRequests,
} from '@epam/ai-dial-shared';
import { DialLinkButton } from '@epam/ai-dial-ui-kit';
import { VisualizerConnector } from '@epam/ai-dial-visualizer-connector';

interface Props {
  attachmentUrl: string;
  renderer: CustomVisualizer;
  mimeType: string;
  isFullScreen?: boolean;
  forceDefaultView?: boolean;
  onFullScreenClick?: () => void;
}

export const VisualizerRenderer = ({
  attachmentUrl,
  renderer,
  mimeType,
  isFullScreen,
  forceDefaultView,
  onFullScreenClick,
}: Props) => {
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const visualizer = useRef<VisualizerConnector | null>(null);
  const { t } = useTranslation(Translation.Chat);

  const [ready, setReady] = useState<boolean>();
  const {
    url: rendererUrl,
    title: visualizerTitle,
    requestTimeout,
    passAuthInfo,
    passExplicitToken,
  } = renderer;

  const dispatch = useAppDispatch();

  const localeLayoutFields = useVisualizerLocaleLayoutFields();
  const authLayoutFields = useVisualizerAuthLayoutFields({
    passAuthInfo,
    passExplicitToken,
  });

  const attachmentDataLoading = useAppSelector(
    ConversationsSelectors.selectCustomAttachmentLoading,
  );

  const themeId = useAppSelector(UISelectors.selectThemeState);

  const customAttachmentData = useAppSelector((state) =>
    ConversationsSelectors.selectCustomAttachmentData(state, attachmentUrl),
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

  const hideTitle = withoutTitleTypes.includes(mimeType) && !forceDefaultView;
  const isBorderless = borderlessTypes.includes(mimeType) && !forceDefaultView;

  const scrollWidth = iframeContainerRef.current?.scrollWidth ?? null;
  const containerHeight = iframeContainerRef.current?.clientHeight ?? null;

  useEffect(() => {
    if (attachmentUrl && !customAttachmentData) {
      dispatch(
        ConversationsActions.getCustomAttachmentData({
          pathToAttachment: attachmentUrl,
        }),
      );
    }
  }, [attachmentUrl, customAttachmentData, dispatch]);

  const customVisualizerLayout: CustomVisualizerDataLayout = useMemo(() => {
    return {
      ...customAttachmentData?.layout,
      width: scrollWidth
        ? scrollWidth
        : (customAttachmentData?.layout.width ??
          DEFAULT_CUSTOM_ATTACHMENT_WIDTH),
      height:
        isFullScreen && containerHeight
          ? containerHeight
          : Number(
              customAttachmentData?.layout.height ??
                DEFAULT_CUSTOM_ATTACHMENT_HEIGHT,
            ),
      themeId,
      ...authLayoutFields,
      ...localeLayoutFields,
    };
  }, [
    containerHeight,
    customAttachmentData?.layout,
    isFullScreen,
    scrollWidth,
    themeId,
    authLayoutFields,
    localeLayoutFields,
  ]);

  const sendMessage = useCallback(
    async (visualizer: VisualizerConnector) => {
      await visualizer.ready();

      const messagePayload: AttachmentData = {
        mimeType,
        visualizerData: {
          ...customAttachmentData,
          layout: customVisualizerLayout,
        },
      };

      visualizer.send(
        VisualizerConnectorRequests.sendVisualizeData,
        messagePayload,
      );
    },
    [mimeType, customAttachmentData, customVisualizerLayout],
  );

  useEffect(() => {
    if (iframeContainerRef.current && !visualizer.current) {
      visualizer.current = new VisualizerConnector(iframeContainerRef.current, {
        domain: rendererUrl,
        hostDomain: window.location.origin,
        visualizerName: visualizerTitle,
        loaderStyles: { display: 'none' },
        requestTimeout,
      });

      return () => {
        visualizer.current?.destroy();
        visualizer.current = null;
      };
    }
  }, [requestTimeout, rendererUrl, visualizerTitle]);

  useEffect(() => {
    if (
      ready &&
      !!visualizer.current &&
      customAttachmentData &&
      iframeContainerRef.current
    ) {
      sendMessage(visualizer.current);
    }
  }, [ready, attachmentUrl, mimeType, sendMessage, customAttachmentData]);

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

  if (!attachmentUrl) {
    return null;
  }

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
            label={t(ChatI18nKeys.Refresh)}
          />

          {isBorderless && (
            <DialLinkButton
              className="text-secondary hover:text-accent-primary"
              iconBefore={<FullScreenIcon size={18} />}
              onClick={onFullScreenClick}
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
          height: !isFullScreen ? customVisualizerLayout.height : undefined,
        }}
      >
        {(!ready || attachmentDataLoading) && (
          <div className="absolute z-10 flex size-full items-center bg-layer-1">
            <Spinner className="mx-auto" size={30} />
          </div>
        )}
      </div>
    </div>
  );
};
