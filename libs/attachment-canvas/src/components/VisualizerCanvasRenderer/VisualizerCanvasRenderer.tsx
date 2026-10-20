import {
  buildCssVars,
  type CustomVisualizerData,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { DIAL_KIT_ICON_STROKE, Spinner } from '@epam/ai-dial-ui-kit';
/*
 * Host side of the custom-visualizer protocol, ported from the npm 0.48.0
 * release into `libs/visualizer-connector`. Visualizer authors still consume
 * the iframe-side `@epam/ai-dial-chat-visualizer-connector` from npm; porting
 * it is a separate follow-up.
 */
import {
  VisualizerConnector,
  VisualizerConnectorEvents,
  VisualizerConnectorRequests,
} from '@epam/ai-dial-visualizer-connector';
import { IconAlertTriangle } from '@tabler/icons-react';
import { type FC, useEffect, useRef, useState } from 'react';
import type {
  GroupedVisualizerCanvasContent,
  VisualizerCanvasContent,
} from '../../models/attachment-canvas';
import { AttachmentContentType } from '../../types/attachment-canvas';
import { getVisualizerMessageContent } from '../../utils/visualizer';
import styles from './VisualizerCanvasRenderer.module.scss';

/** Props for the `VisualizerCanvasRenderer` component. */
export interface VisualizerCanvasRendererProps {
  /** Visualizer content to render. A single-attachment payload is delivered with `SEND_VISUALIZE_DATA`, a grouped one with `SEND_GROUPED_VISUALIZE_DATA`. */
  content: VisualizerCanvasContent | GroupedVisualizerCanvasContent;
  /** Text shown alongside the spinner while the handshake/data delivery is pending. Omitted by default (spinner only). */
  loadingLabel?: string;
  /** Message shown when the visualizer fails to receive its data. Defaults to `'Failed to load visualizer'`. */
  errorLabel?: string;
  /** `title` attribute set on the connector-created iframe, naming it for assistive tech. Defaults to the content's `visualizerName` with surrounding whitespace removed; no attribute is set when that is empty. */
  frameTitle?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: VisualizerCanvasRendererColors;
  /** Called with the `message` string when the iframe posts `${visualizerName}/SEND_MESSAGE` with a non-blank `{ message: string }` payload. When omitted, those messages are ignored. */
  onSendMessage?: (content: string) => void;
}

/** Color overrides for `VisualizerCanvasRenderer`, applied as CSS custom properties. */
interface VisualizerCanvasRendererColors {
  /** Background of the loading overlay. Defaults to `--bg-layer-sunken`. */
  loadingBackground?: string;
  /** Loading/error message text color. Defaults to `--text-primary`. */
  statusText?: string;
  /** Error icon color. Defaults to `--text-error`. */
  errorIcon?: string;
}

enum RendererStatus {
  Loading = 'loading',
  Ready = 'ready',
  Error = 'error',
}

/** Mounts a sandboxed visualizer iframe, drives the handshake, and delivers visualize data. */
export const VisualizerCanvasRenderer: FC<VisualizerCanvasRendererProps> = ({
  content,
  loadingLabel,
  errorLabel = 'Failed to load visualizer',
  frameTitle,
  colors,
  onSendMessage,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<RendererStatus>(RendererStatus.Loading);

  const { url, visualizerName, requestTimeout } = content;

  /*
   * Read via a ref so a parent re-render that only recreates `mimeType`/
   * `layout`/`data` object identity does not tear down and remount the
   * iframe — only a change to `url`/`visualizerName`/`requestTimeout` does.
   */
  const latestPayloadRef = useRef(content);
  latestPayloadRef.current = content;

  /* Same reason: a new callback identity must not remount the iframe. */
  const onSendMessageRef = useRef(onSendMessage);
  onSendMessageRef.current = onSendMessage;

  useEffect(() => {
    const hostElement = hostRef.current;
    if (!hostElement) {
      return;
    }

    setStatus(RendererStatus.Loading);

    const connector = new VisualizerConnector(hostElement, {
      domain: url,
      visualizerName,
      requestTimeout,
    });

    let isActive = true;

    /* Always subscribed, so the host turning the callback on or off never
     * remounts the iframe; without a callback the message is dropped. */
    const unsubscribeSendMessage = connector.subscribe(
      `${visualizerName}/${VisualizerConnectorEvents.SendMessage}`,
      (payload) => {
        const message = getVisualizerMessageContent(payload);
        if (message != null) {
          onSendMessageRef.current?.(message);
        }
      },
    );

    const run = async (): Promise<void> => {
      await connector.ready();
      if (!isActive) {
        return;
      }

      const payload = latestPayloadRef.current;

      if (payload.type === AttachmentContentType.GroupedVisualizer) {
        await connector.send(
          VisualizerConnectorRequests.SendGroupedVisualizeData,
          {
            attachments: payload.attachments,
            layout: payload.layout,
          },
        );
      } else {
        const { mimeType, layout, data } = payload;
        const visualizerData: CustomVisualizerData = {
          layout,
          ...(typeof data === 'object' && data !== null ? data : {}),
        };

        await connector.send(VisualizerConnectorRequests.SendVisualizeData, {
          mimeType,
          visualizerData,
        });
      }
      if (isActive) {
        setStatus(RendererStatus.Ready);
      }
    };

    run().catch(() => {
      if (isActive) {
        setStatus(RendererStatus.Error);
      }
    });

    return () => {
      isActive = false;
      unsubscribeSendMessage();
      connector.destroy();
    };
  }, [url, visualizerName, requestTimeout]);

  /*
   * The connector owns the iframe element, so the accessible name has to be
   * applied to the DOM node it created — an unnamed iframe is announced as an
   * anonymous frame. Kept in its own effect so renaming the frame never tears
   * the connector down and refetches: `visualizerName` is an opaque protocol
   * namespace and may be whitespace, in which case there is no name to give.
   */
  useEffect(() => {
    const accessibleName = frameTitle ?? visualizerName.trim();
    if (accessibleName === '') {
      return;
    }
    hostRef.current
      ?.querySelector('iframe')
      ?.setAttribute('title', accessibleName);
  }, [frameTitle, visualizerName, url, requestTimeout]);

  return (
    <div
      className="relative h-full w-full"
      style={buildCssVars({
        '--vs-loading-bg': colors?.loadingBackground,
        '--vs-status-text': colors?.statusText,
        '--vs-error-icon': colors?.errorIcon,
      })}
    >
      <div ref={hostRef} className="h-full w-full" />
      {status === RendererStatus.Loading && (
        <div
          className={mergeClasses(
            'absolute inset-0 flex flex-col items-center justify-center gap-2',
            styles.loadingOverlay,
          )}
        >
          <Spinner />
          {loadingLabel && (
            <p className={mergeClasses('text-center', styles.statusLabel)}>
              {loadingLabel}
            </p>
          )}
        </div>
      )}
      {status === RendererStatus.Error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <IconAlertTriangle
            size={60}
            stroke={DIAL_KIT_ICON_STROKE}
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
