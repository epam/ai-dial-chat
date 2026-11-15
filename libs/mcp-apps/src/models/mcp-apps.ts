import type { McpAppCanvasContent } from '@epam/ai-dial-attachment-canvas';
import type {
  CallToolResult,
  Implementation,
} from '@modelcontextprotocol/sdk/types.js';
import type { McpAppToolDiscovery, McpDeploymentKind } from '../types/mcp-apps';

type McpUiHostContext = NonNullable<McpAppCanvasContent['hostContext']>;

/** A tool's declared MCP Apps UI resource, keyed by the toolset it was discovered on. */
export interface McpAppToolRef {
  /** Id of the toolset/application this tool was discovered on. */
  toolsetId: string;
  /** The tool's declared `ui://` resource. */
  resourceUri: string;
  /** Name used to correlate this ref against a message's real tool-call data (`resolveMcpAppToolCallSeed`/`findMcpAppForMessage`). */
  toolName: string;
  /** The tool's real name as declared by its owning toolset's `tools/list` — what must be passed to the mounted app/`onToolCall`. */
  mcpToolName: string;
  /** Deployment kind — determines which host MCP proxy route resolves `tools/call` for this tool. */
  kind: McpDeploymentKind;
  /** How this tool was discovered — see `McpAppToolDiscovery`. */
  discovery: McpAppToolDiscovery;
}

/** Original tool call's arguments/result, seeded into the mounted app so it renders that invocation immediately instead of an empty initial state. */
export interface McpAppToolCallSeed {
  /** The tool call's real structured arguments. */
  toolInput?: Record<string, unknown>;
  /** The tool call's result, if already known. */
  toolResult?: CallToolResult;
}

/** Host-provided function that fetches a toolset's MCP Apps `ui://` resource and resolves to its HTML body. */
export type FetchMcpAppResourceHtml = (
  toolsetId: string,
  resourceUri: string,
) => Promise<string>;

/** Host-provided function that forwards an MCP App's tool call through the host's backend. */
export type CallMcpAppTool = (
  toolsetId: string,
  toolName: string,
  args: unknown,
  kind: McpDeploymentKind,
) => Promise<CallToolResult>;

/** A cached MCP App resource fetch plus its resolved tool result. */
export interface CachedMcpAppResponse {
  /** The fetched resource's HTML body. */
  html: string;
  /** The tool call's resolved result, if any. */
  toolResult?: CallToolResult;
}

/** Reads/writes `useMcpAppResponseCache`'s per-conversation cache. */
export interface McpAppResponseCache {
  /**
   * Returns the cached entry only if it was written for this exact
   * `seedKey` (`computeMcpAppSeedKey`) and is younger than the cache's TTL;
   * otherwise `undefined` (a miss), so a stale or seed-mismatched entry is
   * never served.
   */
  get: (
    key: string,
    seedKey: string | undefined,
  ) => CachedMcpAppResponse | undefined;
  /** Writes an entry for `key`, tagged with the seed it was resolved from. */
  set: (
    key: string,
    value: CachedMcpAppResponse,
    seedKey: string | undefined,
  ) => void;
  /** Removes the cached entry for `key`, if any. */
  invalidate: (key: string) => void;
  /**
   * Returns the fresh cached entry for `(key, seedKey)` if one exists
   * (same rules as `get`); otherwise runs `fetchFn` and caches its result.
   * Concurrent calls for the same `(key, seedKey)` before `fetchFn` settles
   * are coalesced onto the same in-flight promise instead of each starting
   * their own — without this, a component re-rendered before its first
   * fetch resolves (e.g. React StrictMode's dev-only double effect
   * invocation) would race two independent fetches/live tool re-calls for
   * the same message.
   */
  getOrFetch: (
    key: string,
    seedKey: string | undefined,
    fetchFn: () => Promise<CachedMcpAppResponse>,
  ) => Promise<CachedMcpAppResponse>;
}

/** Load state of `useMcpAppInlinePreview`'s fetch. */
export enum McpAppInlinePreviewStatus {
  Loading = 'loading',
  Ready = 'ready',
  Error = 'error',
  Unavailable = 'unavailable',
}

/**
 * Dependencies the host must inject into `useMcpAppInlinePreview` /
 * `McpAppInlinePreview` — everything that requires host context (theming,
 * locale, the configured API client) rather than being derivable from the
 * hook's own arguments.
 */
export interface McpAppHostAdapter {
  /** `McpUiHostContext` to deliver to the mounted app's `ui/initialize` handshake. */
  hostContext: McpUiHostContext;
  /** Host identity (`name`/`version`) to deliver to the mounted app's `ui/initialize` handshake. */
  hostInfo: Implementation;
  /** Operator-configured MCP Apps sandbox-proxy URL, or `null` when unconfigured. */
  sandboxUrl: string | null;
  /** Fetches the matched tool's MCP Apps `ui://` resource. */
  fetchResourceHtml: FetchMcpAppResourceHtml;
  /** Forwards a tool call the mounted app makes on its own (`onToolCall`) or the live re-call `resolveMcpAppToolResult` performs. */
  callTool: CallMcpAppTool;
}

/**
 * Color overrides for `McpAppInlinePreview`, applied as CSS custom properties
 * on the preview's root.
 */
export interface McpAppInlinePreviewColors {
  /** Surface the mounted app sits on. Fallback: `--bg-layer-raised`. */
  previewBackground?: string;
  /** Border around the preview card. Fallback: `--stroke-tertiary`. */
  previewBorder?: string;
  /** Divider under the header strip. Fallback: `--stroke-tertiary`. */
  previewHeaderBorder?: string;
  /** Text color of the header strip's app or tool name. Fallback: `--text-secondary`. */
  headerText?: string;
  /** Text color of the "opened in canvas" placeholder. Fallback: `--text-secondary`. */
  placeholderText?: string;
  /** Color of the load-error icon. Fallback: `--text-error`. */
  errorIcon?: string;
  /** Text color of the load-error message. Fallback: `--text-primary`. */
  errorText?: string;
}

/** Typography class overrides for `McpAppInlinePreview`. */
export interface McpAppInlinePreviewTypography {
  /** Typography class of the header strip's tool and app names. Defaults to `'dial-tiny-lead-semi-text'`. */
  headerNameClassName?: string;
  /** Typography class of the "opened in canvas" and load-error messages. Defaults to `'dial-body-text'`. */
  messageClassName?: string;
}
