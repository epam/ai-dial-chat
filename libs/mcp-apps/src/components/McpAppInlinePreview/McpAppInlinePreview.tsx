import { McpAppCanvasRenderer } from '@epam/ai-dial-attachment-canvas';
import type { McpAppDisplayMode } from '@epam/ai-dial-attachment-canvas';
import { buildCssVars } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  EllipsisTooltip,
  GhostIconButton,
  Spinner,
  mergeClasses,
} from '@epam/ai-dial-ui-kit';
import type { Implementation } from '@modelcontextprotocol/sdk/types.js';
import {
  IconAlertTriangle,
  IconArrowsMaximize,
  IconRefresh,
} from '@tabler/icons-react';
import { FC, memo, useCallback, useEffect, useState } from 'react';
import { MCP_APPS_CLASS } from '../../constants/public-class-names';
import { useMcpAppInlinePreview } from '../../hooks/useMcpAppInlinePreview/useMcpAppInlinePreview';
import {
  McpAppInlinePreviewStatus,
  type McpAppHostAdapter,
  type McpAppInlinePreviewColors,
  type McpAppResponseCache,
  type McpAppToolCallSeed,
  type McpAppToolRef,
} from '../../models/mcp-apps';
import styles from './McpAppInlinePreview.module.scss';

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
  /**
   * Whether this message's MCP App is currently open in the full-width
   * canvas. When `true`, the header stays (so the tool/app identity is still
   * visible) but the body shows `openedInCanvasLabel` centered instead of
   * mounting the app — only one live app instance exists at a time.
   */
  isOpenedInCanvas?: boolean;
  /** Message shown centered in the body when `isOpenedInCanvas` is `true`. */
  openedInCanvasLabel: string;
  /** Color overrides applied as CSS custom properties on the preview's root. */
  colors?: McpAppInlinePreviewColors;
}

/** Compact, always-visible header+frame preview of a message's matched MCP App — see `McpAppInlinePreviewProps` and the mcp-app-trigger openspec. */
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
  isOpenedInCanvas = false,
  openedInCanvasLabel,
  colors,
}) => {
  /* Populated once `ui/initialize` completes; reset per `cacheKey` — see mcp-app-trigger spec.md. */
  const [appInfo, setAppInfo] = useState<Implementation | undefined>(undefined);
  useEffect(() => {
    setAppInfo(undefined);
  }, [cacheKey]);

  /* Maps an app's `ui/request-display-mode` to `onExpand` for 'fullscreen' — see mcp-app-trigger spec.md. */
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

  const cssVars = buildCssVars({
    '--mcpapp-preview-bg': colors?.previewBackground,
    '--mcpapp-preview-border': colors?.previewBorder,
    '--mcpapp-preview-header-border': colors?.previewHeaderBorder,
  });

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
    <div
      style={cssVars}
      className={mergeClasses(
        styles.preview,
        'flex w-full min-w-0 flex-col overflow-hidden rounded-xl border',
        MCP_APPS_CLASS.preview,
      )}
    >
      {/*
       * Header strip styled after the code block header in chat-shared's
       * Markdown renderer: same min-height, padding, bottom border, and
       * small ghost icon button group.
       */}
      <div
        className={mergeClasses(
          styles.previewHeader,
          'flex min-h-10 items-center justify-between gap-2 border-b px-4 py-2',
          MCP_APPS_CLASS.previewHeader,
        )}
      >
        <EllipsisTooltip
          text={
            appInfo != null ? (
              <>
                <span className="dial-tiny-lead-semi-text">
                  {match.mcpToolName}
                </span>
                <span
                  aria-hidden
                  className="border-current mx-1.5 inline-block h-3 w-0 border-s align-middle"
                />
                <span className="dial-tiny-lead-semi-text">{appInfo.name}</span>
                {appInfo.version && (
                  <span className="dial-caption-text ms-2">
                    {appInfo.version}
                  </span>
                )}
              </>
            ) : (
              <span className="dial-tiny-lead-semi-text">
                {match.mcpToolName}
              </span>
            )
          }
          className="text-secondary"
        />
        <div
          role="toolbar"
          aria-label={actionsGroupAriaLabel}
          className="flex shrink-0 items-center gap-1"
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
        {isOpenedInCanvas ? (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 flex items-center justify-center p-4"
          >
            <span className="dial-body-text text-center text-secondary">
              {openedInCanvasLabel}
            </span>
          </div>
        ) : (
          <>
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
              <McpAppCanvasRenderer
                content={content}
                errorLabel={loadErrorLabel}
                onAppInfo={setAppInfo}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

/** Renders a compact, always-visible preview of a message's matched MCP App — see `McpAppInlinePreviewProps`. */
export const McpAppInlinePreview = memo(McpAppInlinePreviewBase);
