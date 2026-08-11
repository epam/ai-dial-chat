import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Spinner } from '@epam/ai-dial-ui-kit';
import { AppRenderer } from '@mcp-ui/client';
import { IconAlertTriangle } from '@tabler/icons-react';
import { type FC, useState } from 'react';
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
  const { html, sandboxUrl, toolName, toolInput, toolResult, onToolCall } =
    content;

  return (
    <div className="relative h-full w-full">
      <AppRenderer
        html={html}
        toolName={toolName}
        toolInput={toolInput}
        toolResult={toolResult}
        sandbox={{ url: new URL(sandboxUrl), permissions: 'allow-scripts' }}
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
