import {
  type CustomVisualizerData,
  mergeClasses,
  VisualizerConnectorRequests,
} from '@epam/ai-dial-chat-shared';
import { DialSpinner } from '@epam/ai-dial-ui-kit';
import { VisualizerConnector } from '@epam/ai-dial-visualizer-connector';
import { IconAlertTriangle } from '@tabler/icons-react';
import { type FC, useEffect, useRef, useState } from 'react';
import type { VisualizerCanvasContent } from '../../models/attachment-canvas';
import styles from './VisualizerCanvasRenderer.module.scss';

/** Props for the `VisualizerCanvasRenderer` component. */
export interface VisualizerCanvasRendererProps {
  /** Visualizer content to render. */
  content: VisualizerCanvasContent;
  /** Text shown alongside the spinner while the handshake/data delivery is pending. Omitted by default (spinner only). */
  loadingLabel?: string;
  /** Message shown when the visualizer fails to receive its data. Defaults to `'Failed to load visualizer'`. */
  errorLabel?: string;
}

type RendererStatus = 'loading' | 'ready' | 'error';

/** Mounts a sandboxed visualizer iframe, drives the handshake, and delivers visualize data. */
export const VisualizerCanvasRenderer: FC<VisualizerCanvasRendererProps> = ({
  content,
  loadingLabel,
  errorLabel = 'Failed to load visualizer',
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<RendererStatus>('loading');

  const { url, visualizerName, requestTimeout } = content;

  // Read via a ref so a parent re-render that only recreates `mimeType`/
  // `layout`/`data` object identity does not tear down and remount the
  // iframe — only a change to `url`/`visualizerName`/`requestTimeout` does.
  const latestPayloadRef = useRef(content);
  latestPayloadRef.current = content;

  useEffect(() => {
    const hostElement = hostRef.current;
    if (!hostElement) {
      return;
    }

    setStatus('loading');

    const connector = new VisualizerConnector(hostElement, {
      domain: url,
      visualizerName,
      requestTimeout,
    });

    let isActive = true;

    const run = async (): Promise<void> => {
      await connector.ready();
      if (!isActive) {
        return;
      }

      const { mimeType, layout, data } = latestPayloadRef.current;
      const visualizerData: CustomVisualizerData = {
        layout,
        ...(typeof data === 'object' && data !== null ? data : {}),
      };

      await connector.send(VisualizerConnectorRequests.SendVisualizeData, {
        mimeType,
        visualizerData,
      });
      if (isActive) {
        setStatus('ready');
      }
    };

    run().catch(() => {
      if (isActive) {
        setStatus('error');
      }
    });

    return () => {
      isActive = false;
      connector.destroy();
    };
  }, [url, visualizerName, requestTimeout]);

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="h-full w-full" />
      {status === 'loading' && (
        <div
          className={mergeClasses(
            'absolute inset-0 flex flex-col items-center justify-center gap-2',
            styles.loadingOverlay,
          )}
        >
          <DialSpinner />
          {loadingLabel && (
            <p className={mergeClasses('text-center', styles.statusLabel)}>
              {loadingLabel}
            </p>
          )}
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <IconAlertTriangle
            size={60}
            stroke={1.5}
            aria-hidden
            className={styles.errorIcon}
          />
          <p
            role="alert"
            className={mergeClasses('text-center', styles.statusLabel)}
          >
            {errorLabel}
          </p>
        </div>
      )}
    </div>
  );
};
