import {
  AttachmentType,
  buildCssVars,
  DeploymentIcon,
  MDMessageViewer,
  mergeClasses,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
import { AttachmentGroup } from '@epam/ai-dial-conversation-input';
import { DialRoundedButton } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import type { AssistantMessageBubbleProps } from '../../models/message-bubble';
import { MessageActions } from '../MessageActions/MessageActions';
import styles from './MessageBubble.module.scss';

/** Assistant-authored message bubble, start-aligned with markdown content and optional quick-reply starters. */
export const AssistantMessageBubble: FC<AssistantMessageBubbleProps> = ({
  text,
  styles: bubbleStyles,
  actions,
  hasAlwaysVisibleActions,
  isStreaming,
  attachments,
  afterContent,
  starters,
  onSelectStarter,
  deploymentIconUrl,
  deploymentDisplayName,
  markdownComponents,
  onAttachmentClick,
  onDownloadAll,
  onAttachmentRetry,
  getAttachmentSizeLabel,
  attachmentTheme,
  codeBlockTheme,
  labels,
}) => {
  const { colors, typography, className, bubbleClassName } = bubbleStyles ?? {};
  const {
    attachmentClickLabel,
    attachmentRetryLabel,
    attachmentOpenInNewTabLabel,
    startersAriaLabel = 'Quick reply buttons',
    thinkingLabel,
    codeBlockCopyLabel,
    codeBlockCopiedLabel,
    assistantMessageAriaLabel = 'Assistant message',
    deploymentIconFallbackLabel = 'AI',
  } = labels ?? {};
  const visibleAttachments = isStreaming
    ? (attachments ?? []).filter((a) => a.type !== AttachmentType.Audio)
    : (attachments ?? []);
  const cssVars = buildCssVars({
    '--cm-bubble-text': colors?.text,
    '--cm-starters-divider': colors?.startersDivider,
  });

  const textClass = mergeClasses(styles.text, typography?.fontClassName);

  const hasDeploymentIcon = !!(deploymentIconUrl || deploymentDisplayName);

  return (
    <div
      role="group"
      aria-label={assistantMessageAriaLabel}
      style={cssVars}
      className={mergeClasses('flex w-full items-start gap-3', className)}
    >
      {hasDeploymentIcon && (
        <DeploymentIcon
          src={deploymentIconUrl}
          size={28}
          initialsName={deploymentDisplayName || deploymentIconFallbackLabel}
          labels={{
            tooltip: deploymentDisplayName ?? deploymentIconFallbackLabel,
          }}
        />
      )}
      <div className="flex w-full min-w-0 max-w-full flex-col items-start gap-5">
        <div
          className={mergeClasses(
            'flex w-full min-w-0 max-w-full flex-col items-start gap-4',
            bubbleClassName,
          )}
        >
          {(text || isStreaming) && (
            <div
              aria-live="polite"
              aria-atomic="false"
              className={mergeClasses(
                textClass,
                'min-w-0 max-w-full text-start',
              )}
            >
              <MDMessageViewer
                content={text}
                isStreaming={isStreaming}
                thinkingLabel={thinkingLabel}
                components={markdownComponents}
                codeBlockCopyLabel={codeBlockCopyLabel}
                codeBlockCopiedLabel={codeBlockCopiedLabel}
                codeBlockTheme={codeBlockTheme}
              />
            </div>
          )}
          <AttachmentGroup
            attachments={visibleAttachments}
            onAttachmentClick={onAttachmentClick}
            onDownloadAll={onDownloadAll}
            onRetry={onAttachmentRetry}
            labels={{
              clickLabel: attachmentClickLabel,
              retryLabel: attachmentRetryLabel,
              openInNewTabLabel: attachmentOpenInNewTabLabel,
            }}
            getSizeLabel={getAttachmentSizeLabel}
            theme={attachmentTheme}
          />
          {afterContent}
          <MessageActions
            {...actions}
            isAlwaysVisible={hasAlwaysVisibleActions}
            role={MessageRole.Assistant}
          />
        </div>
        {starters && starters.length > 0 && onSelectStarter && (
          <div
            role="list"
            aria-label={startersAriaLabel}
            className={mergeClasses(
              'flex w-full flex-wrap gap-2 border-t pt-5',
              styles.startersDivider,
            )}
          >
            {starters.map((starter, index) => (
              <div key={index} role="listitem" className="min-w-[40px]">
                <DialRoundedButton
                  label={starter.title}
                  className="min-w-[40px]"
                  onClick={() => onSelectStarter(starter)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
