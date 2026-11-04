import {
  McpAppInlinePreview,
  findMcpAppForMessage,
  mcpAppCanvasKey,
} from '@epam/ai-dial-mcp-apps';
import { FC } from 'react';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AttachmentCanvasI18nKeys,
  ButtonsI18nKeys,
} from '../../../constants/translation-keys';
import type { ConversationMessageItemProps } from '../ConversationMessageItem';

interface MessageMcpAppPreviewProps extends Pick<
  ConversationMessageItemProps,
  'index' | 'mcpAppCache' | 'openedInCanvasLabel'
> {
  mcpAppMatch: NonNullable<ReturnType<typeof findMcpAppForMessage>>;
  onOpenApp: NonNullable<ConversationMessageItemProps['onOpenApp']>;
  mcpAppToolCallSeed: ComponentProps<typeof McpAppInlinePreview>['toolCall'];
  mcpAppHostAdapter: ComponentProps<typeof McpAppInlinePreview>['hostAdapter'];
  mcpAppKey: string | undefined;
  isMcpAppOpenedInCanvas: boolean;
}

/**
 * The inline MCP app preview for an assistant message whose tool result
 * matches an MCP-UI tool, expandable into the canvas. Presentational and
 * private to `ConversationMessageItem`.
 */
const MessageMcpAppPreview: FC<MessageMcpAppPreviewProps> = ({
  index,
  mcpAppCache,
  openedInCanvasLabel,
  mcpAppMatch,
  onOpenApp,
  mcpAppToolCallSeed,
  mcpAppHostAdapter,
  mcpAppKey,
  isMcpAppOpenedInCanvas,
}) => {
  const { t } = useTranslation();

  return (
    <McpAppInlinePreview
      match={mcpAppMatch}
      toolCall={mcpAppToolCallSeed}
      cache={mcpAppCache}
      cacheKey={mcpAppCanvasKey(index)}
      hostAdapter={mcpAppHostAdapter}
      onExpand={() => onOpenApp(mcpAppMatch, mcpAppKey, mcpAppToolCallSeed)}
      expandAriaLabel={t(AttachmentCanvasI18nKeys.ExpandAppLabel)}
      reloadAriaLabel={t(ButtonsI18nKeys.Reload)}
      loadErrorLabel={t(AttachmentCanvasI18nKeys.McpAppLoadErrorLabel)}
      isOpenedInCanvas={isMcpAppOpenedInCanvas}
      openedInCanvasLabel={openedInCanvasLabel ?? 'Opened in canvas'}
    />
  );
};

export default MessageMcpAppPreview;
