import {
  buildCssVars,
  mergeClasses,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
import { AttachmentTray } from '@epam/ai-dial-conversation-input';
import {
  DIAL_ICON_SIZE,
  DialLinkButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { FC } from 'react';
import { useCollapsedText } from '../../hooks/useCollapsedText';
import type { UserMessageBubbleProps } from '../../models/MessageBubble';
import { BubblePosition } from '../../types/bubble-position';
import { MessageActions } from '../Message/MessageActions';
import styles from './MessageBubble.module.scss';

const DEFAULT_COLLAPSED_LINE_COUNT = 10;

/** User-authored message bubble, right-aligned with configurable radius based on group position. */
export const UserMessageBubble: FC<UserMessageBubbleProps> = ({
  text,
  position = BubblePosition.Bottom,
  className,
  bubbleClassName,
  styles: bubbleStyles,
  actions,
  hasAlwaysVisibleActions,
  attachments,
  collapsedLineCount = DEFAULT_COLLAPSED_LINE_COUNT,
  showMoreLabel = 'Show more',
  showLessLabel = 'Show less',
  showMoreAriaLabel,
  showLessAriaLabel,
  onAttachmentClick,
  attachmentClickLabel,
}) => {
  const { colors, typography } = bubbleStyles ?? {};
  const noCustomClass = !typography?.fontClassName;

  const {
    textRef,
    isTextCollapsed,
    isOverflowing,
    collapsedMaxHeight,
    expandedMaxHeight,
    isCollapsed,
    toggleCollapsed,
  } = useCollapsedText({ text, collapsedLineCount });

  const cssVars = buildCssVars({
    '--cm-bubble-user-bg': colors?.userBackground,
    '--cm-bubble-text': colors?.text,
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
    '--cm-bubble-collapsed-height': isOverflowing
      ? `${collapsedMaxHeight}px`
      : undefined,
    '--cm-bubble-expanded-height': isOverflowing
      ? `${expandedMaxHeight}px`
      : undefined,
  });

  const positionRadius =
    position === BubblePosition.Top ? 'rounded-ee-[24px]' : 'rounded-se-[24px]';

  const textClass = mergeClasses(styles.text, typography?.fontClassName);
  const expandAriaLabel = showMoreAriaLabel ?? showMoreLabel;
  const collapseAriaLabel = showLessAriaLabel ?? showLessLabel;
  const toggleLabel = isCollapsed ? showMoreLabel : showLessLabel;
  const toggleAriaLabel = isCollapsed ? expandAriaLabel : collapseAriaLabel;
  const ToggleIcon = isCollapsed ? IconChevronDown : IconChevronUp;
  return (
    <div style={cssVars} className={mergeClasses('flex w-full', className)}>
      <div className="ms-auto flex w-fit flex-col items-end gap-4">
        <AttachmentTray
          attachments={attachments ?? []}
          onAttachmentClick={onAttachmentClick}
          clickLabel={attachmentClickLabel}
          className="max-w-[640px] flex-wrap justify-end overflow-x-visible"
        />
        {text && (
          <div
            className={mergeClasses(
              styles.userBubble,
              'flex w-fit items-center justify-end rounded-es-[16px] rounded-ss-[16px] px-6 py-4',
              positionRadius,
              bubbleClassName,
            )}
          >
            <div className="flex min-w-0 flex-col items-start">
              <div
                className={mergeClasses(
                  'relative overflow-hidden',
                  isOverflowing && styles.collapsibleText,
                  isOverflowing && !isCollapsed && styles.expandedText,
                  isTextCollapsed && styles.collapsedText,
                )}
              >
                <p
                  ref={textRef}
                  className={mergeClasses(
                    textClass,
                    'whitespace-pre-wrap text-start [overflow-wrap:anywhere]',
                  )}
                >
                  {text}
                </p>
              </div>
              {isOverflowing && (
                <DialLinkButton
                  label={<>{toggleLabel}</>}
                  iconBefore={
                    <ToggleIcon size={DIAL_ICON_SIZE.SM} aria-hidden="true" />
                  }
                  aria-label={toggleAriaLabel}
                  className="mt-3"
                  onClick={toggleCollapsed}
                  size={ElementSize.Small}
                />
              )}
            </div>
          </div>
        )}
        <MessageActions
          {...actions}
          isAlwaysVisible={hasAlwaysVisibleActions}
          role={MessageRole.User}
        />
      </div>
    </div>
  );
};
