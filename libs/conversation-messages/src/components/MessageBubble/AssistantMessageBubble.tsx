import {
  buildCssVars,
  mergeClasses,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
import { AttachmentTray } from '@epam/ai-dial-conversation-input';
import { DialRoundedButton, DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { FC, useEffect, useRef, useState } from 'react';
import FallbackEntityIcon from '../../assets/fallback-entity-icon.svg?react';
import type { AssistantMessageBubbleProps } from '../../models/MessageBubble.js';
import { MDMessageViewer } from '../Markdown/MDMessageViewer.js';
import { MessageActions } from '../Message/MessageActions.js';
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
}) => {
  const [isIconFailed, setIsIconFailed] = useState(false);
  const iconImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setIsIconFailed(false);
  }, [deploymentIconUrl]);

  useEffect(() => {
    const el = iconImgRef.current;
    if (!el) return;
    const handleError = () => setIsIconFailed(true);
    el.addEventListener('error', handleError);
    return () => el.removeEventListener('error', handleError);
  }, [deploymentIconUrl]);

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
        <div
          className={mergeClasses(
            styles.agentIconBadge,
            'size-7 shrink-0 overflow-hidden rounded-full',
          )}
        >
          {deploymentIconUrl && !isIconFailed ? (
            <div className="m-[3px] size-[calc(100%-6px)]">
              <img
                ref={iconImgRef}
                src={deploymentIconUrl}
                alt={deploymentDisplayName ?? ''}
                className="size-full object-contain"
              />
            </div>
          ) : (
            <div className="flex size-full items-center justify-center">
              <FallbackEntityIcon
                width={DIAL_ICON_SIZE.LG}
                height={DIAL_ICON_SIZE.LG}
                className="shrink-0"
              />
            </div>
          )}
        </div>
      )}
      <div className="flex min-w-0 max-w-full flex-col items-start gap-5">
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
                'min-w-0 max-w-full text-left',
              )}
            >
              <MDMessageViewer
                content={text}
                isStreaming={isStreaming}
                thinkingLabel={thinkingLabel}
              />
            </div>
          )}
          <AttachmentTray attachments={attachments ?? []} />
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
