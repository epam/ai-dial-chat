import {
  buildCssVars,
  mergeClasses,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
import {
  AttachmentTray,
  DeploymentIcon,
} from '@epam/ai-dial-conversation-input';
import { DialRoundedButton } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import type { AssistantMessageBubbleProps } from '../../models/MessageBubble';
import { MDMessageViewer } from '../Markdown/MDMessageViewer';
import { MessageActions } from '../Message/MessageActions';
import styles from './MessageBubble.module.scss';

/** Assistant-authored message bubble, left-aligned with markdown content and optional quick-reply starters. */
export const AssistantMessageBubble: FC<AssistantMessageBubbleProps> = ({
  text,
  className,
  bubbleClassName,
  styles: bubbleStyles,
  actions,
  hasAlwaysVisibleActions,
  isStreaming,
  attachments,
  afterContent,
  starters,
  onSelectStarter,
  startersAriaLabel = 'Quick reply buttons',
  deploymentIconUrl,
  deploymentDisplayName,
  thinkingLabel,
  markdownComponents,
  onAttachmentClick,
}) => {
  const { colors, typography } = bubbleStyles ?? {};
  const noCustomClass = !typography?.fontClassName;
  const cssVars = buildCssVars({
    '--cm-bubble-text': colors?.text,
    '--cm-starters-divider': colors?.startersDivider,
    '--cm-bubble-font-family': noCustomClass
      ? typography?.fontFamily
      : undefined,
    '--cm-bubble-font-size': noCustomClass ? typography?.fontSize : undefined,
    '--cm-bubble-font-weight': noCustomClass
      ? typography?.fontWeight
      : undefined,
    '--cm-bubble-line-height': noCustomClass
      ? typography?.lineHeight
      : undefined,
  });

  const textClass = mergeClasses(styles.text, typography?.fontClassName);

  const hasDeploymentIcon = !!(deploymentIconUrl || deploymentDisplayName);

  return (
    <div
      style={cssVars}
      className={mergeClasses('flex w-full items-start gap-5', className)}
    >
      {hasDeploymentIcon && (
        <DeploymentIcon
          src={deploymentIconUrl}
          size={28}
          badgeClassName={styles.agentIconBadge}
          tooltip={deploymentDisplayName}
        />
      )}
      <div className="flex w-full min-w-0 max-w-full flex-col items-start gap-5">
        <div
          className={mergeClasses(
            'flex w-fit min-w-0 max-w-full flex-col items-start gap-4',
            bubbleClassName,
          )}
        >
          {(text || isStreaming) && (
            <div
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
              />
            </div>
          )}
          <AttachmentTray
            attachments={attachments ?? []}
            onAttachmentClick={onAttachmentClick}
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
