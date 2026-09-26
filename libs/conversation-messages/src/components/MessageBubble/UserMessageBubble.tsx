import { AttachmentGroup } from '@epam/ai-dial-attachment-input';
import {
  buildCssVars,
  DisplayAttachment,
  mergeClasses,
  MessageRole,
  useCollapsedText,
} from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, ElementSize, LinkButton } from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { FC, useId } from 'react';
import { CONVERSATION_MESSAGES_CLASS } from '../../constants/public-class-names';
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
  textSegments,
  onAttachmentClick,
  onDownloadAll,
  onAttachmentRetry,
  selectedAttachmentId,
}) => {
  const { colors, typography, className, bubbleClassName } = bubbleStyles ?? {};
  const {
    showMoreLabel = 'Show more',
    showLessLabel = 'Show less',
    showMoreAriaLabel,
    showLessAriaLabel,
    attachmentClickLabel,
    attachmentRetryLabel,
    attachmentOpenInNewTabLabel,
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
  } = useCollapsedText<HTMLParagraphElement>({
    text: text ?? '',
    collapsedLineCount,
  });

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
      ? 'rounded-ee-md rounded-se-2xl'
      : 'rounded-se-md rounded-ee-2xl';

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
          onAttachmentClick={(id) =>
            onAttachmentClick?.(
              attachments?.find((a) => a.id === id) as DisplayAttachment,
            )
          }
          onDownloadAll={onDownloadAll}
          onRetry={onAttachmentRetry}
          labels={{
            clickLabel: attachmentClickLabel,
            retryLabel: attachmentRetryLabel,
            openInNewTabLabel: attachmentOpenInNewTabLabel,
          }}
          styles={{ className: 'max-w-[640px]' }}
          selectedAttachmentId={selectedAttachmentId}
        />
        {text && (
          <div
            className={mergeClasses(
              styles.userBubble,
              'flex w-fit items-center justify-end rounded-es-2xl rounded-ss-2xl border px-6 py-4',
              positionRadius,
              bubbleClassName,
              CONVERSATION_MESSAGES_CLASS.userBubble,
            )}
          >
            <div className="flex min-w-0 flex-col items-start">
              <div
                id={collapsibleTextId}
                className={mergeClasses(
                  // Bleed room for chip edges — see design.md Decision 3a.
                  'relative -me-1 -ms-1 w-[calc(100%+8px)] overflow-hidden pe-1 ps-1',
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
                  {/*
                   * `textSegments` (when present) replaces `text` here with
                   * interleaved plain-text runs and inline elements (e.g.
                   * skill-mention chips at their text position) — `text`
                   * itself remains non-empty in that case too (a mention is
                   * literal `/{name}` text), so this component never needs a
                   * separate "segments with no text" branch: `text`'s own
                   * truthiness gate above already covers both cases, and the
                   * `useCollapsedText` ref-based measurement above measures
                   * whatever is actually rendered here, segments included.
                   */}
                  {textSegments ?? text}
                </p>
              </div>
              {isOverflowing && (
                <LinkButton
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
