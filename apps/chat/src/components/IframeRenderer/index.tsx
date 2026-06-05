import React, {
  Ref,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useRouter } from 'next/router';

import { useVisualizerAuthLayoutFields } from '@/src/hooks/useVisualizerAuthLayoutFields';
import { useVisualizerLocaleLayoutFields } from '@/src/hooks/useVisualizerLocaleLayoutFields';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/selectors';

import { Routes } from '@/src/constants/routes';

import { Spinner } from '@/src/components/Common/Spinner';

import {
  AttachmentData,
  CustomVisualizerData,
  CustomVisualizerDataLayout,
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
  onMessage?: (event: MessageEvent) => void;
  containerStyle?: React.CSSProperties;
  containerClassName?: string;
  conversationId?: string;
  passAuthInfo?: boolean;
  passExplicitToken?: boolean;
}

export const IframeRenderer = forwardRef<HTMLDivElement, IframeRendererProps>(
  (
    {
      iframeUrl,
      title,
      width = '100%',
      height = '100%',
      onMessage,
      containerStyle = {},
      containerClassName = '',
      conversationId,
      passAuthInfo,
      passExplicitToken,
    },
    ref: Ref<HTMLDivElement>,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const visualizer = useRef<VisualizerConnector | null>(null);
    const localeLayoutFields = useVisualizerLocaleLayoutFields();
    const authLayoutFields = useVisualizerAuthLayoutFields({
      passAuthInfo,
      passExplicitToken,
    });
    const themeId = useAppSelector(UISelectors.selectThemeState);

    const router = useRouter();

    const isPreviewConversation = useMemo(() => {
      return router.pathname === Routes.AppsEditor;
    }, [router.pathname]);

    const [loading, setLoading] = useState<boolean>(true);

    const visualizerLayout = useMemo(
      (): CustomVisualizerDataLayout => ({
        width: 0,
        height: 0,
        themeId,
        ...authLayoutFields,
        ...localeLayoutFields,
      }),
      [themeId, authLayoutFields, localeLayoutFields],
    );

    useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

    useEffect(() => {
      if (visualizer.current) {
        visualizer.current.destroy();
      }

      if (containerRef.current && !visualizer.current) {
        visualizer.current = new VisualizerConnector(containerRef.current, {
          domain: iframeUrl,
          hostDomain: window.location.origin,
          visualizerName: title,
          loaderClass: 'bg-layer-1',
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

        if (
          event.data.type ===
          `${title}/${VisualizerConnectorEvents.readyToInteract}`
        ) {
          setLoading(false);
        }
      },
      [onMessage, title],
    );

    const sendMessage = useCallback(
      async (visualizer: VisualizerConnector) => {
        const messagePayload: AttachmentData = {
          mimeType: 'application/json',
          visualizerData: {
            isPreview: isPreviewConversation,
            conversationId: conversationId,
            layout: visualizerLayout,
            // TODO: fix typing here
          } as CustomVisualizerData,
        };
        await visualizer.ready();

        visualizer.send(
          VisualizerConnectorRequests.sendVisualizeData,
          messagePayload,
        );
      },
      [isPreviewConversation, conversationId, visualizerLayout],
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
          className={containerClassName}
          style={{ ...containerStyle, width, height, position: 'relative' }}
        ></div>
      </div>
    );
  },
);

IframeRenderer.displayName = 'IframeRenderer';
