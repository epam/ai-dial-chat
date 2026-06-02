import {
  buildCssVars,
  mergeClasses,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
import { AttachmentTray } from '@epam/ai-dial-conversation-input';
import { DialRoundedButton } from '@epam/ai-dial-ui-kit';
import { IconRobot } from '@tabler/icons-react';
import { FC, useEffect, useRef, useState } from 'react';
import type { AssistantMessageBubbleProps } from '../../models/MessageBubble.js';
import { MDMessageViewer } from '../Markdown/MDMessageViewer.js';
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
  afterContent,
  starters,
  onSelectStarter,
  startersAriaLabel = 'Quick reply buttons',
  deploymentIconUrl,
  deploymentDisplayName,
}) => {
  const [isIconFailed, setIsIconFailed] = useState(false);
  const iconImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setIsIconFailed(false);
  }, [deploymentIconUrl]);

  useEffect(() => {
    const el = iconImgRef.current;
    if (!el) return;
    const handler = () => setIsIconFailed(true);
    el.addEventListener('error', handler);
    return () => el.removeEventListener('error', handler);
  }, [deploymentIconUrl]);

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
    <div style={cssVars} className={mergeClasses('flex w-full', className)}>
      <div className="flex w-full flex-col items-start gap-5">
        <div
          className={mergeClasses(
            'flex w-fit flex-col items-start gap-4',
            bubbleClassName,
          )}
        >
          {hasDeploymentIcon && (
            <div className="flex items-center gap-1.5">
              {deploymentIconUrl && !isIconFailed ? (
                <img
                  ref={iconImgRef}
                  src={deploymentIconUrl}
                  alt=""
                  width={16}
                  height={16}
                  className="shrink-0"
                />
              ) : (
                <IconRobot size={16} className="shrink-0" />
              )}
              {deploymentDisplayName && (
                <span className="text-xs text-secondary">
                  {deploymentDisplayName}
                </span>
              )}
            </div>
          )}
          <div className={mergeClasses(textClass, 'text-left')}>
            <MDMessageViewer content={text} />
          </div>
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
