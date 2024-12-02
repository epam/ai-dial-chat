import React, {
  Ref,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import {
  VisualizerConnectorEvents,
  VisualizerConnectorRequest,
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
    },
    ref: Ref<HTMLDivElement>,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const visualizer = useRef<VisualizerConnector | null>(null);
    const [, setLoading] = useState<boolean>(true);

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
          loaderStyles: { display: 'none' },
        });

        return () => {
          visualizer.current?.destroy();
          visualizer.current = null;
        };
      }
    }, [iframeUrl, title]);

    const handleMessage = useCallback(
      (event: MessageEvent<VisualizerConnectorRequest>) => {
        if (event.origin !== expectedOrigin()) return;

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
      [expectedOrigin, onMessage, title],
    );

    useEffect(() => {
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [handleMessage]);

    return (
      <div
        ref={containerRef}
        className={`${containerClassName}`}
        style={{ ...containerStyle, width, height, position: 'relative' }}
      ></div>
    );
  },
);

IframeRenderer.displayName = 'IframeRenderer';
