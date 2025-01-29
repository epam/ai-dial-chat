import React, {
  Ref,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { Conversation } from '@/src/types/chat';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch } from '@/src/store/hooks';
import { ModelsActions } from '@/src/store/models/models.reducers';

import { Spinner } from '../Common/Spinner';

import {
  AttachmentData,
  VisualizerConnectorEvents,
  VisualizerConnectorRequest,
  VisualizerConnectorRequests,
} from '@epam/ai-dial-shared';
import { VisualizerConnector } from '@epam/ai-dial-visualizer-connector';

interface IframeRendererProps {
  iframeUrl: string;
  title: string;
  width?: number | string;
  height?: number | string;
  targetOrigin?: string;
  onMessage?: (event: MessageEvent) => void;
  containerStyle?: React.CSSProperties;
  containerClassName?: string;
  isPreviewConversation?: boolean;
  conversationId?: string;
}

export const IframeRenderer = forwardRef<HTMLDivElement, IframeRendererProps>(
  (
    {
      iframeUrl,
      title,
      width = '100%',
      height = '100%',
      targetOrigin,
      onMessage,
      containerStyle = {},
      containerClassName = '',
      isPreviewConversation,
      conversationId,
    },
    ref: Ref<HTMLDivElement>,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const visualizer = useRef<VisualizerConnector | null>(null);
    const dispatch = useAppDispatch();

    const [loading, setLoading] = useState<boolean>(true);

    const expectedOrigin = useCallback(
      () => targetOrigin || new URL(iframeUrl).origin,
      [iframeUrl, targetOrigin],
    );

    useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

    useEffect(() => {
      if (containerRef.current && !visualizer.current) {
        visualizer.current = new VisualizerConnector(containerRef.current, {
          domain: iframeUrl,
          hostDomain: window.location.origin,
          visualizerName: title,
        });

        return () => {
          visualizer.current?.destroy();
          visualizer.current = null;
        };
      }
    }, [iframeUrl, title]);

    const handleMessage = useCallback(
      (event: MessageEvent<VisualizerConnectorRequest>) => {
        if (event.data?.type?.split('/')[0] !== title) return;

        if (onMessage) {
          onMessage(event);
        }

        if (event.data.type === `${title}/CREATED_CONVERSATION_SUCCESS`) {
          const { conversation } = event.data.payload as unknown as {
            conversation?: Conversation;
          };

          if (conversation) {
            dispatch(
              ConversationsActions.addConversations({
                conversations: [conversation],
              }),
            );
            dispatch(
              ConversationsActions.selectConversations({
                conversationIds: [conversation.id],
              }),
            );
            dispatch(
              ModelsActions.updateRecentModels({
                modelId: conversation.model.id,
              }),
            );
          }
        }

        if (
          event.data.type ===
          `${title}/${VisualizerConnectorEvents.readyToInteract}`
        ) {
          setLoading(false);
        }
      },
      [expectedOrigin, onMessage, title],
    );

    const sendMessage = useCallback(
      async (visualizer: VisualizerConnector) => {
        const messagePayload: AttachmentData = {
          mimeType: 'application/json',
          visualizerData: {
            isPreview: isPreviewConversation,
            conversationId: conversationId,
            layout: { width: 0, height: 0 },
          } as any,
        };
        await visualizer.ready();

        visualizer.send(
          VisualizerConnectorRequests.sendVisualizeData,
          messagePayload,
        );
      },
      [isPreviewConversation, conversationId],
    );

    useEffect(() => {
      if (!!visualizer.current && containerRef.current) {
        sendMessage(visualizer.current);
      }
    }, [loading, sendMessage, isPreviewConversation, conversationId]);

    useEffect(() => {
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [handleMessage]);

    return (
      <div className="relative size-full bg-layer-1">
        {loading && (
          <div className="absolute z-10 flex size-full items-center bg-layer-1">
            <Spinner className="mx-auto" size={50} />
          </div>
        )}
        <div
          ref={containerRef}
          className={`${containerClassName}`}
          style={{ ...containerStyle, width, height, position: 'relative' }}
        ></div>
      </div>
    );
  },
);

IframeRenderer.displayName = 'IframeRenderer';
