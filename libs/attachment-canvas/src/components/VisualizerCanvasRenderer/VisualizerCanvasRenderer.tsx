import {
  buildCssVars,
  type CustomVisualizerData,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
/*
 * Host drives the iframe via published `@epam/ai-dial-visualizer-connector`
 * (+ `@epam/ai-dial-shared` for the request enum). A later follow-up may port
 * those packages into this monorepo — see checklist below.
 *
 * Migration checklist:
 * 1. Port `VisualizerConnector` into `libs/visualizer-connector` with
 *    peerDep `@epam/ai-dial-chat-shared` (not `@epam/ai-dial-shared`).
 * 2. Port `ChatVisualizerConnector` into `libs/chat-visualizer-connector`
 *    for third-party authors; publish from this monorepo.
 * 3. Keep wire values (`SEND_VISUALIZE_DATA`, `READY`, …) identical.
 *    Align enum member names with host conventions (PascalCase
 *    `SendVisualizeData`) — npm `@epam/ai-dial-shared` uses camelCase
 *    (`sendVisualizeData`).
 * 4. Drop `hostDomain` from the constructor call below if the ported
 *    `VisualizerConnectorOptions` no longer requires it (npm type requires
 *    it; runtime currently ignores it).
 * 5. Carry forward security/hygiene fixes not present in the published package:
 *    - idempotent `destroy()` (`isDestroyed` guard; README promises no-op)
 *    - strict origin equality in `ChatVisualizerConnector` (not `startsWith`)
 *    - sandbox `allow-same-origin`+`allow-scripts` rationale comment/spec
 * 6. Remove root deps / attachment-canvas peers for
 *    `@epam/ai-dial-visualizer-connector` and `@epam/ai-dial-shared`.
 * 7. Point this file at workspace `@epam/ai-dial-visualizer-connector` and
 *    `@epam/ai-dial-chat-shared` for the request enum.
 * 8. Update `openspec/specs/custom-visualizers/spec.md` accordingly.
 */
import { VisualizerConnectorRequests } from '@epam/ai-dial-shared';
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
  /** Color overrides applied as CSS custom properties. */
  colors?: VisualizerCanvasRendererColors;
}

/** Color overrides for `VisualizerCanvasRenderer`, applied as CSS custom properties. */
export interface VisualizerCanvasRendererColors {
  /** Background of the loading overlay. Defaults to `--bg-layer-1`. */
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
  colors,
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

  useEffect(() => {
    const hostElement = hostRef.current;
    if (!hostElement) {
      return;
    }

    setStatus(RendererStatus.Loading);

    /* `hostDomain` is required by the published VisualizerConnectorOptions
     * type but unused at runtime in the current development package — pass
     * the page origin for type compatibility. */
    const connector = new VisualizerConnector(hostElement, {
      domain: url,
      hostDomain: window.location.origin,
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

      await connector.send(VisualizerConnectorRequests.sendVisualizeData, {
        mimeType,
        visualizerData,
      });
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
      connector.destroy();
    };
  }, [url, visualizerName, requestTimeout]);

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
          <DialSpinner />
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
