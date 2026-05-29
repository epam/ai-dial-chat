import {
  buildCssVars,
  mergeClasses,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
import { AttachmentTray } from '@epam/ai-dial-conversation-input';
import { DialRoundedButton } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import type { AssistantMessageBubbleProps } from '../../models/MessageBubble.js';
import { MessageActions } from '../Message/MessageActions.js';
import styles from './MessageBubble.module.scss';

export const AssistantMessageBubble: FC<AssistantMessageBubbleProps> = ({
  text,
  className,
  bubbleClassName,
  colors,
  typography,
  actions,
  hasAlwaysVisibleActions,
  attachments,
  starters,
  onSelectStarter,
  startersAriaLabel = 'Quick reply buttons',
}) => {
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

  return (
    <div style={cssVars} className={mergeClasses('flex w-full', className)}>
      <div className="flex w-full flex-col items-start gap-5">
        <div
          className={mergeClasses(
            'flex w-fit flex-col items-start gap-4',
            bubbleClassName,
          )}
        >
          <p className={mergeClasses(textClass, 'text-left')}>{text}</p>
          <AttachmentTray attachments={attachments ?? []} />
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
            {starters.map((starter) => (
              <div key={starter.const} role="listitem" className="min-w-[40px]">
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
