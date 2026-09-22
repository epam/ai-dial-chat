import { AppBridge } from '@mcp-ui/client';
import {
  McpUiHostContextChangedNotificationSchema,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps/app-bridge';
import { type RefObject, useEffect, useRef, useState } from 'react';
import type {
  McpAppCanvasContent,
  McpAppDisplayMode,
} from '../../models/attachment-canvas';

/*
 * Fallback host identity advertised during the `ui/initialize` handshake when
 * `content.hostInfo` is omitted — the same default `@mcp-ui/client`'s
 * `AppRenderer` used before this package started owning its `AppBridge`
 * directly. A lib must not hardcode the app's own name/version (library
 * isolation), so the app layer supplies those via `content.hostInfo`.
 */
const DEFAULT_HOST_INFO = { name: 'MCP-UI Host', version: '1.0.0' };
const HOST_CAPABILITIES = { openLinks: {} };

/*
 * Default `ui/open-link` behavior: open the URL in a new browser tab. Only
 * http(s) URLs are opened — the guest app is untrusted content, and a
 * `javascript:` (or any other exotic-scheme) URL must never reach
 * `window.open`. Returns `false` only when the URL is rejected or the call
 * itself throws, so the app receives an error result instead.
 *
 * The returned handle is deliberately NOT used to detect a blocked pop-up:
 * `noopener` severs the opener relationship, so `window.open` resolves to
 * `null` even when the tab opened successfully, and testing it would report
 * every successful open as a failure. Keeping `noopener,noreferrer` matters
 * more than block detection here — the guest app is untrusted, and handing
 * it a live `window.opener` back into the host is the larger risk.
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
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    return false;
  }
  return true;
};

/*
 * Applies `containerDimensions` from an app-initiated
 * `ui/notifications/host-context-changed` notification to the sandbox
 * iframe — the same inline-style assignment `AppFrame` performs for the
 * app's `size-changed` notifications. A fixed `width`/`height` replaces
 * the iframe's `100%`-wide/`600px`-tall defaults (and any earlier
 * app-reported size); `maxWidth`/`maxHeight` only clamp them.
 *
 * In fullscreen the surface is host-owned, so no app-requested sizing is
 * applied at all and any ceiling left over from an earlier inline request is
 * cleared: `maxWidth`/`maxHeight` are separate properties from
 * `width`/`height`, so `.fullscreenFrame`'s `100% !important` alone would
 * not cancel them and a request such as `{ maxWidth: 670, maxHeight: 382 }`
 * would shrink the fullscreen canvas.
 */
const applyContainerDimensions = (
  frame: HTMLIFrameElement,
  dimensions: McpUiHostContext['containerDimensions'],
  isFullscreen: boolean,
): void => {
  if (isFullscreen) {
    frame.style.maxWidth = '';
    frame.style.maxHeight = '';
    return;
  }
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

/** Outcome of the bridge's mount attempt. */
export interface UseMcpAppBridgeResult {
  /** Connected bridge to hand to `AppFrame`, or `null` before it mounts or after it failed. */
  appBridge: AppBridge | null;
  /** Whether creating the bridge threw, so the caller can render its error state. */
  hasFailed: boolean;
}

/**
 * Owns one `AppBridge` for the lifetime of the component: creates it, answers
 * the app's `ui/open-link`, `ui/request-display-mode`, `tools/call` and
 * container-dimension requests from the latest `content`, pushes host-context
 * changes to the app, and closes it on unmount.
 *
 * @param content MCP app content whose callbacks answer the app's requests.
 * @param containerRef Element containing the sandbox iframe `AppFrame` mounts.
 * @param liveHostContext Host context to push to the app whenever it changes.
 */
export const useMcpAppBridge = (
  content: McpAppCanvasContent,
  containerRef: RefObject<HTMLDivElement | null>,
  liveHostContext: McpUiHostContext | undefined,
): UseMcpAppBridgeResult => {
  /*
   * The handlers below are wired once per mount, so they read the content's
   * callbacks through this ref, refreshed after every render — the same
   * pattern `@mcp-ui/client`'s `AppRenderer` uses internally.
   */
  const contentRef = useRef(content);
  useEffect(() => {
    contentRef.current = content;
  });

  const [appBridge, setAppBridge] = useState<AppBridge | null>(null);
  const [hasFailed, setHasFailed] = useState(false);

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
      /* Seeds `ui/initialize`'s `containerDimensions` synchronously — see design.md D20. */
      const rect = containerRef.current?.getBoundingClientRect();
      const initialHostContext =
        rect != null && rect.width > 0 && rect.height > 0
          ? {
              ...contentRef.current.hostContext,
              containerDimensions: {
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
            }
          : contentRef.current.hostContext;
      bridge = new AppBridge(
        null,
        contentRef.current.hostInfo ?? DEFAULT_HOST_INFO,
        HOST_CAPABILITIES,
        {
          hostContext: initialHostContext,
        },
      );
      bridge.onopenlink = async ({ url }) => {
        const handler = contentRef.current.onOpenLink;
        const isOpened = handler != null ? handler(url) : openLinkInNewTab(url);
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
            applyContainerDimensions(
              frame,
              params.containerDimensions,
              contentRef.current.hostContext?.displayMode === 'fullscreen',
            );
          }
        },
      );
      setAppBridge(bridge);
    } catch (err) {
      console.error('[useMcpAppBridge] Error creating AppBridge:', err);
      setHasFailed(true);
    }
    return () => {
      bridge
        ?.close()
        .catch((closeError) =>
          console.error(
            '[useMcpAppBridge] Error closing AppBridge:',
            closeError,
          ),
        );
    };
  }, [containerRef]);

  /*
   * Propagates live host-context changes (resize, theme switch) to the
   * mounted app. `appBridge` becomes non-null as soon as this hook creates
   * it, but `AppFrame` only calls `.connect()` on it later, once the sandbox
   * proxy iframe reports ready — `transport` stays undefined until then, and
   * `setHostContext` throws `Not connected` if a change lands first (slower
   * apps widen this race).
   */
  useEffect(() => {
    if (
      appBridge != null &&
      appBridge.transport != null &&
      liveHostContext != null
    ) {
      appBridge.setHostContext(liveHostContext);
    }
  }, [appBridge, liveHostContext]);

  return { appBridge, hasFailed };
};
