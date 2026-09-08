import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_KIT_ICON_STROKE, Spinner } from '@epam/ai-dial-ui-kit';
import { AppBridge, AppFrame } from '@mcp-ui/client';
import {
  McpUiHostContextChangedNotificationSchema,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps/app-bridge';
import { IconAlertTriangle } from '@tabler/icons-react';
import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import type {
  McpAppCanvasContent,
  McpAppDisplayMode,
} from '../../models/attachment-canvas';
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
 * Host identity/capabilities advertised during the `ui/initialize` handshake —
 * the same defaults `@mcp-ui/client`'s `AppRenderer` used before this component
 * started owning its `AppBridge` directly.
 */
const HOST_INFO = { name: 'MCP-UI Host', version: '1.0.0' };
const HOST_CAPABILITIES = { openLinks: {} };

/*
 * Default `ui/open-link` behavior: open the URL in a new browser tab. Only
 * http(s) URLs are opened — the guest app is untrusted content, and a
 * `javascript:` (or any other exotic-scheme) URL must never reach
 * `window.open`. Returns `false` when the URL is rejected or the browser
 * blocked the pop-up, so the app receives an error result instead.
 */
const openLinkInNewTab = (url: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }
  return window.open(url, '_blank', 'noopener,noreferrer') != null;
};

/*
 * Applies `containerDimensions` from an app-initiated
 * `ui/notifications/host-context-changed` notification to the sandbox
 * iframe — the same inline-style assignment `AppFrame` performs for the
 * app's `size-changed` notifications. A fixed `width`/`height` replaces
 * the iframe's `100%`-wide/`600px`-tall defaults (and any earlier
 * app-reported size); `maxWidth`/`maxHeight` only clamp them. The
 * `.fullscreenFrame` rule still wins in the fullscreen canvas, so a
 * request never shrinks that surface.
 */
const applyContainerDimensions = (
  frame: HTMLIFrameElement,
  dimensions: McpUiHostContext['containerDimensions'],
): void => {
  /*
   * The protocol type is an intersection of unions ({height|maxHeight} &
   * {width|maxWidth}) that TypeScript won't let property-access directly;
   * every member is assignable to this plain optional-field shape, which
   * mirrors how the zod schema parses the same payload.
   */
  const requested:
    | {
        /** Fixed container width in pixels. */
        width?: number;
        /** Maximum container width in pixels. */
        maxWidth?: number;
        /** Fixed container height in pixels. */
        height?: number;
        /** Maximum container height in pixels. */
        maxHeight?: number;
      }
    | undefined = dimensions;
  if (requested == null) return;
  if (requested.width != null) {
    frame.style.width = `${requested.width}px`;
  }
  if (requested.maxWidth != null) {
    frame.style.maxWidth = `${requested.maxWidth}px`;
  }
  if (requested.height != null) {
    frame.style.height = `${requested.height}px`;
  }
  if (requested.maxHeight != null) {
    frame.style.maxHeight = `${requested.maxHeight}px`;
  }
};

/*
 * Mounts an MCP tool's `ui://` resource via `@mcp-ui/client`'s `AppFrame`,
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
    toolInput,
    toolResult,
    hostContext,
    onToolCall,
    onOpenLink,
    onRequestDisplayMode,
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
   * `hostContext.containerDimensions` — the `AppBridge` below sends a
   * `ui/notifications/host-context-changed` notification whenever
   * `setHostContext` is called with changed values, so a resize here
   * (drag-resizing the panel, window resize) reaches a well-behaved app
   * live, not just once at mount.
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setContainerSize({
        width: Math.round(width),
        height: Math.round(height),
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const liveHostContext = useMemo(() => {
    if (hostContext == null || containerSize == null) return hostContext;
    return { ...hostContext, containerDimensions: containerSize };
  }, [hostContext, containerSize]);

  /*
   * The `AppBridge` handlers below are wired once per mount, so they read
   * the content's callbacks through this ref, refreshed after every render —
   * the same pattern `@mcp-ui/client`'s `AppRenderer` uses internally.
   */
  const contentRef = useRef(content);
  useEffect(() => {
    contentRef.current = content;
  });

  const [appBridge, setAppBridge] = useState<AppBridge | null>(null);

  useEffect(() => {
    let bridge: AppBridge | null = null;
    try {
      /*
       * `AppRenderer` (which this component previously used) never forwards
       * `ui/request-display-mode` to the host — the `AppBridge` it creates
       * internally answers every request with the current mode, so the host
       * never learns an app wants to switch surfaces. Owning the bridge here
       * is the only way to act on that request; `AppFrame` still handles
       * everything else (iframe, transport, connect, tool input/result
       * delivery) exactly as before.
       */
      bridge = new AppBridge(null, HOST_INFO, HOST_CAPABILITIES, {
        hostContext: contentRef.current.hostContext,
      });
      bridge.onopenlink = async ({ url }) => {
        const handler = contentRef.current.onOpenLink;
        const isOpened =
          handler != null ? handler(url) : openLinkInNewTab(url);
        return isOpened === false ? { isError: true } : {};
      };
      bridge.onrequestdisplaymode = async ({ mode }) => {
        const handler = contentRef.current.onRequestDisplayMode;
        const currentMode: McpAppDisplayMode =
          contentRef.current.hostContext?.displayMode ?? 'inline';
        return { mode: handler?.(mode) ?? currentMode };
      };
      bridge.oncalltool = (params) =>
        contentRef.current.onToolCall(params.name, params.arguments);
      /*
       * Some apps request the container size they need via an app-initiated
       * `ui/notifications/host-context-changed` notification instead of the
       * standard `size-changed` one. `AppFrame` registers no handler for it,
       * so the bridge would silently drop the request and the iframe would
       * stay at its `100%`-wide/`600px`-tall defaults. The handler queries
       * the iframe at invocation time because `AppFrame` creates it in its
       * own mount effect, which may run after this one.
       */
      bridge.setNotificationHandler(
        McpUiHostContextChangedNotificationSchema,
        ({ params }) => {
          const frame =
            containerRef.current?.querySelector<HTMLIFrameElement>('iframe');
          if (frame != null) {
            applyContainerDimensions(frame, params.containerDimensions);
          }
        },
      );
      setAppBridge(bridge);
    } catch (err) {
      console.error('[McpAppCanvasRenderer] Error creating AppBridge:', err);
      setStatus(RendererStatus.Error);
    }
    return () => {
      bridge
        ?.close()
        .catch((closeError) =>
          console.error(
            '[McpAppCanvasRenderer] Error closing AppBridge:',
            closeError,
          ),
        );
    };
  }, []);

  /* Propagates live host-context changes (resize, theme switch) to the mounted app. */
  useEffect(() => {
    if (appBridge != null && liveHostContext != null) {
      appBridge.setHostContext(liveHostContext);
    }
  }, [appBridge, liveHostContext]);

  return (
    <div
      ref={containerRef}
      className={mergeClasses(
        'relative h-full w-full',
        isFullscreen && styles.fullscreenFrame,
      )}
    >
      {appBridge != null && (
        <AppFrame
          html={html}
          sandbox={sandbox}
          appBridge={appBridge}
          toolInput={toolInput}
          toolResult={toolResult}
          onSizeChanged={() => setStatus(RendererStatus.Ready)}
          onInitialized={() => setStatus(RendererStatus.Ready)}
          onError={() => setStatus(RendererStatus.Error)}
        />
      )}
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
