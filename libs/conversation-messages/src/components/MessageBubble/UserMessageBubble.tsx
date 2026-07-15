import {
  buildCssVars,
  mergeClasses,
  MessageRole,
  useCollapsedText,
} from '@epam/ai-dial-chat-shared';
import { AttachmentGroup } from '@epam/ai-dial-conversation-input';
import {
  DIAL_ICON_SIZE,
  DialLinkButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { FC, useId } from 'react';
import type { UserMessageBubbleProps } from '../../models/message-bubble';
import { BubblePosition } from '../../types/bubble-position';
import { MessageActions } from '../MessageActions/MessageActions';
import styles from './MessageBubble.module.scss';

const DEFAULT_COLLAPSED_LINE_COUNT = 10;

/** User-authored message bubble, end-aligned with configurable radius based on group position. */
export const UserMessageBubble: FC<UserMessageBubbleProps> = ({
  text,
  position = BubblePosition.Bottom,
  styles: bubbleStyles,
  actions,
  hasAlwaysVisibleActions,
  attachments,
  collapsedLineCount = DEFAULT_COLLAPSED_LINE_COUNT,
  labels,
  onAttachmentClick,
  onDownloadAll,
  onAttachmentRetry,
  getAttachmentSizeLabel,
  attachmentTheme,
}) => {
  const { colors, typography, className, bubbleClassName } = bubbleStyles ?? {};
  const {
    showMoreLabel = 'Show more',
    showLessLabel = 'Show less',
    showMoreAriaLabel,
    showLessAriaLabel,
    attachmentClickLabel,
    attachmentRetryLabel,
    userMessageAriaLabel = 'User message',
  } = labels ?? {};

  const {
    textRef,
    isTextCollapsed,
    isOverflowing,
    collapsedMaxHeight,
    expandedMaxHeight,
    isCollapsed,
    toggleCollapsed,
  } = useCollapsedText<HTMLParagraphElement>({ text, collapsedLineCount });

  const cssVars = buildCssVars({
    '--cm-bubble-user-bg': colors?.userBackground,
    '--cm-bubble-user-border': colors?.userBorder,
    '--cm-bubble-fade-start': colors?.fadeStart,
    '--cm-bubble-text': colors?.text,
    '--cm-bubble-collapsed-height': isOverflowing
      ? `${collapsedMaxHeight}px`
      : undefined,
    '--cm-bubble-expanded-height': isOverflowing
      ? `${expandedMaxHeight}px`
      : undefined,
  });

  const positionRadius =
    position === BubblePosition.Top
      ? 'rounded-ee-[6px] rounded-se-[16px]'
      : 'rounded-se-[6px] rounded-ee-[16px]';

  const textClass = mergeClasses(styles.text, typography?.fontClassName);
  const expandAriaLabel = showMoreAriaLabel ?? showMoreLabel;
  const collapseAriaLabel = showLessAriaLabel ?? showLessLabel;
  const toggleLabel = isCollapsed ? showMoreLabel : showLessLabel;
  const toggleAriaLabel = isCollapsed ? expandAriaLabel : collapseAriaLabel;
  const ToggleIcon = isCollapsed ? IconChevronDown : IconChevronUp;
  const collapsibleTextId = useId();
  return (
    <div
      role="group"
      aria-label={userMessageAriaLabel}
      style={cssVars}
      className={mergeClasses('flex w-full', className)}
    >
      <div className="ms-auto flex w-fit min-w-0 max-w-full flex-col items-end gap-4">
        <AttachmentGroup
          attachments={attachments ?? []}
          onAttachmentClick={onAttachmentClick}
          onDownloadAll={onDownloadAll}
          onRetry={onAttachmentRetry}
          labels={{
            clickLabel: attachmentClickLabel,
            retryLabel: attachmentRetryLabel,
          }}
          getSizeLabel={getAttachmentSizeLabel}
          theme={attachmentTheme}
          className="max-w-[640px]"
        />
        {text && (
          <div
            className={mergeClasses(
              styles.userBubble,
              'flex w-fit items-center justify-end rounded-es-2xl rounded-ss-2xl border px-6 py-4',
              positionRadius,
              bubbleClassName,
            )}
          >
            <div className="flex min-w-0 flex-col items-start">
              <div
                id={collapsibleTextId}
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
                  aria-expanded={!isCollapsed}
                  aria-controls={collapsibleTextId}
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
