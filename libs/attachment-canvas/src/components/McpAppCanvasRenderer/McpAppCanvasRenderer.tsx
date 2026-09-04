import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_KIT_ICON_STROKE, Spinner } from '@epam/ai-dial-ui-kit';
import { AppRenderer } from '@mcp-ui/client';
import { IconAlertTriangle } from '@tabler/icons-react';
import {
  type FC,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { McpAppCanvasContent } from '../../models/attachment-canvas';
import styles from './McpAppCanvasRenderer.module.scss';

/** Props for the `McpAppCanvasRenderer` component. */
export interface McpAppCanvasRendererProps {
  /** MCP App content to render. */
  content: McpAppCanvasContent;
  /** Message shown when the app fails to initialize. Defaults to `'Failed to load app'`. */
  errorLabel?: string;
}

enum RendererStatus {
  Loading = 'loading',
  Ready = 'ready',
  Error = 'error',
}

/*
 * Mounts an MCP tool's `ui://` resource via `@mcp-ui/client`'s `AppRenderer`,
 * inside the isolated-origin sandbox proxy at `content.sandboxUrl`, seeded
 * with the original invocation's `content.toolInput`/`content.toolResult`
 * so the app renders that result immediately rather than an empty initial
 * state, and forwards `tools/call` requests to `content.onToolCall`.
 */
/** Renders an MCP app in a sandboxed iframe inside the attachment canvas. */
export const McpAppCanvasRenderer: FC<McpAppCanvasRendererProps> = ({
  content,
  errorLabel = 'Failed to load app',
}) => {
  const [status, setStatus] = useState<RendererStatus>(RendererStatus.Loading);
  const {
    html,
    sandboxUrl,
    toolName,
    toolInput,
    toolResult,
    hostContext,
    onToolCall,
  } = content;
  /*
   * `AppFrame` re-creates its sandbox iframe whenever `sandbox.url` changes
   * identity (its mount effect depends on the object itself, not just
   * `.href`) — a literal `new URL(sandboxUrl)` on every render churns the
   * iframe on every re-render of a host that doesn't memoize `content`
   * itself (e.g. a preview mounted continuously alongside a streaming
   * message), which can keep the app stuck reinitializing and never reach
   * `onSizeChanged`. Memoized here so identity only changes with the URL.
   */
  const sandbox = useMemo(() => ({ url: new URL(sandboxUrl) }), [sandboxUrl]);
  const isFullscreen = hostContext?.displayMode === 'fullscreen';

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  }>();

  /*
   * Reports the real, live pixel size of this component's own container
   * (e.g. the resizable attachment canvas panel) to the mounted app via
   * `hostContext.containerDimensions` — `AppRenderer` calls the AppBridge's
   * `setHostContext` whenever its `hostContext` prop changes, which sends a
   * `ui/notifications/host-context-changed` notification, so a resize here
   * (drag-resizing the panel, window resize) reaches a well-behaved app
   * live, not just once at mount.
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setContainerSize({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const liveHostContext = useMemo(() => {
    if (hostContext == null || containerSize == null) return hostContext;
    return { ...hostContext, containerDimensions: containerSize };
  }, [hostContext, containerSize]);

  return (
    <div
      ref={containerRef}
      className={mergeClasses(
        'relative h-full w-full',
        isFullscreen && styles.fullscreenFrame,
      )}
    >
      <AppRenderer
        html={html}
        toolName={toolName}
        toolInput={toolInput}
        toolResult={toolResult}
        hostContext={liveHostContext}
        sandbox={sandbox}
        onCallTool={(params) => onToolCall(params.name, params.arguments)}
        /*
         * AppRenderer does not expose an explicit "ready"/handshake-complete
         * callback (only AppFrame's lower-level onInitialized, which
         * AppRenderer doesn't re-expose) — the first size-change
         * notification the mounted app sends is used as a best-effort
         * readiness signal instead.
         */
        onSizeChanged={() => setStatus(RendererStatus.Ready)}
        onError={() => setStatus(RendererStatus.Error)}
      />
      {status === RendererStatus.Loading && (
        <div
          className={mergeClasses(
            'absolute inset-0 flex flex-col items-center justify-center gap-2',
            styles.loadingOverlay,
          )}
        >
          <Spinner />
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
