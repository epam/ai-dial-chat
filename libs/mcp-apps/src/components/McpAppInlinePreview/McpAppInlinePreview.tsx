import { McpAppCanvasRenderer } from '@epam/ai-dial-attachment-canvas';
import type { McpAppDisplayMode } from '@epam/ai-dial-attachment-canvas';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  GhostIconButton,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import {
  IconAlertTriangle,
  IconArrowsMaximize,
  IconRefresh,
} from '@tabler/icons-react';
import { FC, memo, useCallback } from 'react';
import { useMcpAppInlinePreview } from '../../hooks/useMcpAppInlinePreview/useMcpAppInlinePreview';
import {
  McpAppInlinePreviewStatus,
  type McpAppHostAdapter,
  type McpAppResponseCache,
  type McpAppToolCallSeed,
  type McpAppToolRef,
} from '../../models/mcp-apps';

/** Props for the `McpAppInlinePreview` component. */
export interface McpAppInlinePreviewProps {
  /** Matched MCP App tool to preview. */
  match: McpAppToolRef;
  /** Original tool call's arguments/result, seeding the mounted app's initial state. */
  toolCall?: McpAppToolCallSeed;
  /** Shared cache (with a full-width canvas) so switching to it for this message reuses this preview's fetch instead of repeating it. */
  cache: McpAppResponseCache;
  /** This message's cache key (e.g. `mcpAppCanvasKey(index)`). */
  cacheKey: string;
  /** Host-supplied dependencies — display context, sandbox URL, and the resource-fetch/tool-call functions. */
  hostAdapter: McpAppHostAdapter;
  /** Called when the user activates the expand-to-canvas button. */
  onExpand: () => void;
  /** Accessible label for the expand-to-canvas button. */
  expandAriaLabel: string;
  /** Accessible label for the reload button. */
  reloadAriaLabel: string;
  /** Accessible name for the header's actions group. Defaults to `'MCP app actions'`. */
  actionsGroupAriaLabel?: string;
  /** Message shown when the resource fails to load or the app fails to initialize. */
  loadErrorLabel: string;
}

/**
 * Renders a compact, always-visible preview of a message's matched MCP App
 * directly under the message body, spanning the full available width and
 * sized to the mounted app's actual content height. A header strip above the
 * app — styled like the code block's header in `@epam/ai-dial-chat-shared`'s
 * Markdown renderer, with small ghost icon buttons — carries a reload button
 * (re-fetches from scratch, bypassing `cache`) and the expand-to-canvas
 * button (`onExpand`). It sits outside the app's rendered content, so it
 * never overlaps whatever the app draws. Renders nothing while
 * `hostAdapter.sandboxUrl` isn't configured.
 */
const McpAppInlinePreviewBase: FC<McpAppInlinePreviewProps> = ({
  match,
  toolCall,
  cache,
  cacheKey,
  hostAdapter,
  onExpand,
  expandAriaLabel,
  reloadAriaLabel,
  actionsGroupAriaLabel = 'MCP app actions',
  loadErrorLabel,
}) => {
  /*
   * An app mounted in the compact preview can ask to go fullscreen via
   * `ui/request-display-mode` — answered by expanding into the full-width
   * canvas, the same surface the expand button opens. Any other mode request
   * (including `pip`, which no surface here provides) keeps the preview.
   */
  const handleRequestDisplayMode = useCallback(
    (mode: McpAppDisplayMode): McpAppDisplayMode => {
      if (mode === 'fullscreen') {
        onExpand();
        return 'fullscreen';
      }
      return 'inline';
    },
    [onExpand],
  );

  const { status, content, reload } = useMcpAppInlinePreview(
    match,
    toolCall,
    cache,
    cacheKey,
    hostAdapter,
    handleRequestDisplayMode,
  );

  if (status === McpAppInlinePreviewStatus.Unavailable) {
    return null;
  }

  return (
    <div className="bg-layer-2 flex w-full min-w-0 flex-col overflow-hidden rounded-xl border border-tertiary">
      {/*
       * Header strip styled after the code block header in chat-shared's
       * Markdown renderer: same min-height, padding, bottom border, and
       * small ghost icon button group.
       */}
      <div className="flex min-h-10 items-center justify-end border-b border-tertiary px-4 py-2">
        <div
          role="toolbar"
          aria-label={actionsGroupAriaLabel}
          className="flex items-center gap-1"
        >
          <GhostIconButton
            icon={
              <IconRefresh
                size={DIAL_ICON_SIZE.SM}
                stroke={DIAL_KIT_ICON_STROKE}
                aria-hidden
              />
            }
            aria-label={reloadAriaLabel}
            size={ElementSize.Small}
            onClick={reload}
          />
          <GhostIconButton
            icon={
              <IconArrowsMaximize
                size={DIAL_ICON_SIZE.SM}
                stroke={DIAL_KIT_ICON_STROKE}
                aria-hidden
              />
            }
            aria-label={expandAriaLabel}
            size={ElementSize.Small}
            onClick={onExpand}
          />
        </div>
      </div>
      <div className="relative min-h-[200px] w-full">
        {status === McpAppInlinePreviewStatus.Loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </div>
        )}
        {status === McpAppInlinePreviewStatus.Error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
            <IconAlertTriangle
              size={40}
              stroke={DIAL_KIT_ICON_STROKE}
              aria-hidden
              className="text-error"
            />
            <p role="alert" className="dial-body-text text-center text-primary">
              {loadErrorLabel}
            </p>
          </div>
        )}
        {status === McpAppInlinePreviewStatus.Ready && content && (
          <McpAppCanvasRenderer content={content} errorLabel={loadErrorLabel} />
        )}
      </div>
    </div>
  );
};

/** Renders a compact, always-visible preview of a message's matched MCP App — see `McpAppInlinePreviewProps`. */
export const McpAppInlinePreview = memo(McpAppInlinePreviewBase);
