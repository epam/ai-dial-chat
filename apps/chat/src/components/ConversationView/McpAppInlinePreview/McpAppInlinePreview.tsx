import { McpAppCanvasRenderer } from '@epam/ai-dial-attachment-canvas';
import {
  DIAL_KIT_ICON_STROKE,
  GhostIconButton,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import {
  IconAlertTriangle,
  IconArrowsMaximize,
  IconRefresh,
} from '@tabler/icons-react';
import { FC, memo } from 'react';
import {
  McpAppInlinePreviewStatus,
  useMcpAppInlinePreview,
} from '../../../hooks/attachment/useMcpAppInlinePreview';
import type { McpAppResponseCache } from '../../../hooks/attachment/useMcpAppResponseCache';
import type { McpAppToolCallSeed } from '../../../hooks/attachment/useOpenMcpAppCanvas';
import type { McpAppToolRef } from '../../../hooks/conversation/useMcpAppTools';

/** Props for the `McpAppInlinePreview` component. */
export interface Props {
  /** Matched MCP App tool to preview. */
  match: McpAppToolRef;
  /** Original tool call's arguments/result, seeding the mounted app's initial state. */
  toolCall?: McpAppToolCallSeed;
  /** Shared cache (with `useOpenMcpAppCanvas`) so switching to the full canvas for this message reuses this preview's fetch instead of repeating it. */
  cache: McpAppResponseCache;
  /** This message's cache key (`mcpAppCanvasKey(index)`). */
  cacheKey: string;
  /** Called when the user activates the expand-to-canvas button. */
  onExpand: () => void;
  /** Accessible label for the expand-to-canvas button. */
  expandAriaLabel: string;
  /** Accessible label for the reload button. */
  reloadAriaLabel: string;
  /** Message shown when the resource fails to load or the app fails to initialize. */
  loadErrorLabel: string;
}

/**
 * Renders a compact, always-visible preview of a message's matched MCP App
 * directly under the message body, spanning the full available width and
 * sized to the mounted app's actual content height. A header strip above the
 * app — outside its rendered content, so it never overlaps whatever the app
 * draws — carries a reload button (re-fetches from scratch, bypassing
 * `cache`) and the expand-to-canvas button (`onExpand`,
 * `useOpenMcpAppCanvas`, which reuses the same cache entry this preview
 * populated). Renders nothing while the MCP Apps sandbox proxy isn't
 * configured, matching `useOpenMcpAppCanvas`'s own no-op behavior in that
 * case.
 */
const McpAppInlinePreview: FC<Props> = ({
  match,
  toolCall,
  cache,
  cacheKey,
  onExpand,
  expandAriaLabel,
  reloadAriaLabel,
  loadErrorLabel,
}) => {
  const { status, content, reload } = useMcpAppInlinePreview(
    match,
    toolCall,
    cache,
    cacheKey,
  );

  if (status === McpAppInlinePreviewStatus.Unavailable) {
    return null;
  }

  return (
    <div className="border-tertiary bg-layer-2 flex w-full flex-col overflow-hidden rounded border">
      <div className="border-tertiary flex items-center justify-end gap-1 border-b px-3 py-1.5">
        <GhostIconButton
          icon={
            <IconRefresh size={16} stroke={DIAL_KIT_ICON_STROKE} aria-hidden />
          }
          aria-label={reloadAriaLabel}
          onClick={reload}
        />
        <GhostIconButton
          icon={
            <IconArrowsMaximize
              size={16}
              stroke={DIAL_KIT_ICON_STROKE}
              aria-hidden
            />
          }
          aria-label={expandAriaLabel}
          onClick={onExpand}
        />
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
            <p
              role="alert"
              className="dial-body-text text-center text-primary"
            >
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

export default memo(McpAppInlinePreview);
