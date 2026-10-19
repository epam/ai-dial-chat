import { AttachmentGroup } from '@epam/ai-dial-attachment-input';
import {
  buildCssVars,
  buildInlineSegmentSource,
  createInlineSegmentComponents,
  createRehypeInlineSegments,
  MDMessageViewer,
  mergeClasses,
  MessageRole,
  useCollapsedText,
} from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, ElementSize, LinkButton } from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { FC, useId, useMemo } from 'react';
import type { Options } from 'react-markdown';
import { CONVERSATION_MESSAGES_CLASS } from '../../constants/public-class-names';
import type { UserMessageBubbleProps } from '../../models/message-bubble';
import { BubblePosition } from '../../types/bubble-position';
import { copySelectionWithoutStyles } from '../../utils/clipboard';
import { MessageActions } from '../MessageActions/MessageActions';
import { MessageTimestamp } from '../MessageTimestamp/MessageTimestamp';
import styles from './MessageBubble.module.scss';

const DEFAULT_COLLAPSED_LINE_COUNT = 10;

/*
 * Drops the outer margins of the first and last markdown blocks so a
 * single-paragraph message keeps the bubble's own padding. The markdown
 * renderer wraps its blocks in one root div, hence the extra `>div` step.
 */
const MARKDOWN_EDGE_MARGIN_CLASS_NAME =
  '[&>div>*:first-child]:mt-0 [&>div>*:last-child]:mb-0';

/* Stable empty plugin list, so a message without segments never re-parses on re-render. */
const NO_REHYPE_PLUGINS: NonNullable<Options['rehypePlugins']> = [];

/** User-authored message bubble, end-aligned with configurable radius based on group position. */
export const UserMessageBubble: FC<UserMessageBubbleProps> = ({
  text,
  contentRef,
  position = BubblePosition.Bottom,
  styles: bubbleStyles,
  actions,
  hasAlwaysVisibleActions,
  timestamp,
  locale,
  attachments,
  collapsedLineCount = DEFAULT_COLLAPSED_LINE_COUNT,
  labels,
  textSegments,
  onAttachmentClick,
  onDownloadAll,
  onAttachmentRetry,
  selectedAttachmentId,
  markdownClassNames,
  markdownUrlTransform,
  codeBlockTheme,
  tableOnOpenInCanvas,
}) => {
  const { colors, typography, className, bubbleClassName, timestampClassName } =
    bubbleStyles ?? {};
  const timestampNode =
    timestamp != null ? (
      <MessageTimestamp
        timestamp={timestamp}
        locale={locale}
        className={timestampClassName}
      />
    ) : undefined;
  const {
    showMoreLabel = 'Show more',
    showLessLabel = 'Show less',
    showMoreAriaLabel,
    showLessAriaLabel,
    attachmentClickLabel,
    attachmentDownloadLabel,
    attachmentRetryLabel,
    attachmentOpenInNewTabLabel,
    userMessageAriaLabel = 'User message',
    codeBlockCopyLabel,
    codeBlockCopiedLabel,
    codeBlockDownloadLabel,
    tableCopyLabel,
    tableCopiedLabel,
    tableDownloadCsvLabel,
    tableOpenInCanvasLabel,
    tableDownloadFilename,
    tableScrollRegionAriaLabel,
    mathScrollRegionAriaLabel,
  } = labels ?? {};
  const tableActionLabels = useMemo(
    () => ({
      copyLabel: tableCopyLabel,
      copiedLabel: tableCopiedLabel,
      downloadCsvLabel: tableDownloadCsvLabel,
      openInCanvasLabel: tableOpenInCanvasLabel,
    }),
    [
      tableCopyLabel,
      tableCopiedLabel,
      tableDownloadCsvLabel,
      tableOpenInCanvasLabel,
    ],
  );

  const {
    textRef,
    isTextCollapsed,
    isOverflowing,
    collapsedMaxHeight,
    expandedMaxHeight,
    isCollapsed,
    toggleCollapsed,
  } = useCollapsedText<HTMLDivElement>({
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
  const { markdownSource, segmentRehypePlugins, segmentComponents } =
    useMemo(() => {
      if (textSegments == null) {
        return {
          markdownSource: text ?? '',
          segmentRehypePlugins: NO_REHYPE_PLUGINS,
          segmentComponents: undefined,
        };
      }
      const { source, inlineSegments } = buildInlineSegmentSource(textSegments);
      return {
        markdownSource: source,
        segmentRehypePlugins: [
          createRehypeInlineSegments(inlineSegments),
        ] as NonNullable<Options['rehypePlugins']>,
        segmentComponents: createInlineSegmentComponents(inlineSegments),
      };
    }, [text, textSegments]);
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
      onCopy={copySelectionWithoutStyles}
      className={mergeClasses('group/message flex w-full', className)}
    >
      <div className="ms-auto flex w-fit max-w-full min-w-0 flex-col items-end gap-4">
        <AttachmentGroup
          attachments={attachments ?? []}
          onAttachmentClick={
            onAttachmentClick
              ? (id) => {
                  const attachment = attachments?.find((a) => a.id === id);
                  if (attachment) onAttachmentClick(attachment);
                }
              : undefined
          }
          onDownloadAll={onDownloadAll}
          onRetry={onAttachmentRetry}
          labels={{
            clickLabel: attachmentClickLabel,
            downloadLabel: attachmentDownloadLabel,
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
              'flex w-fit items-center justify-end rounded-ss-2xl rounded-es-2xl border px-6 py-4',
              positionRadius,
              bubbleClassName,
              CONVERSATION_MESSAGES_CLASS.userBubble,
            )}
          >
            <div className="flex min-w-0 flex-col items-start">
              <div
                id={collapsibleTextId}
                ref={contentRef}
                className={mergeClasses(
                  // Bleed room for chip edges — see `openspec/changes/archive/2026-09-25-multi-skill-message-mentions/design.md` Decision 3a.
                  'relative -ms-1 -me-1 w-[calc(100%+8px)] overflow-hidden ps-1 pe-1',
                  isOverflowing && styles.collapsibleText,
                  isOverflowing && !isCollapsed && styles.expandedText,
                  isTextCollapsed && styles.collapsedText,
                )}
              >
                <div
                  ref={textRef}
                  className={mergeClasses(
                    textClass,
                    'max-w-full min-w-0 text-start',
                    MARKDOWN_EDGE_MARGIN_CLASS_NAME,
                  )}
                >
                  {/*
                   * The text renders through the same markdown pipeline as an
                   * assistant message, except that raw HTML stays literal: a
                   * user asking about `<div>` must see the tag, not lose it
                   * to the HTML parser. `useCollapsedText` measures this
                   * container, so code blocks and tables count toward the
                   * collapse height. `textSegments` (when present) carries
                   * inline elements such as skill-mention chips through the
                   * parser at their text position.
                   */}
                  <MDMessageViewer
                    content={markdownSource}
                    isRawHtmlEnabled={false}
                    rehypePlugins={segmentRehypePlugins}
                    components={segmentComponents}
                    classNames={markdownClassNames}
                    urlTransform={markdownUrlTransform}
                    codeBlockCopyLabel={codeBlockCopyLabel}
                    codeBlockCopiedLabel={codeBlockCopiedLabel}
                    codeBlockDownloadLabel={codeBlockDownloadLabel}
                    codeBlockTheme={codeBlockTheme}
                    tableActionLabels={tableActionLabels}
                    tableDownloadFilename={tableDownloadFilename}
                    tableOnOpenInCanvas={tableOnOpenInCanvas}
                    tableScrollRegionAriaLabel={tableScrollRegionAriaLabel}
                    mathScrollRegionAriaLabel={mathScrollRegionAriaLabel}
                  />
                </div>
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
          leadingContent={
            timestampNode != null ? (
              <>
                {timestampNode}
                {actions?.leadingContent}
              </>
            ) : (
              actions?.leadingContent
            )
          }
          role={MessageRole.User}
        />
      </div>
    </div>
  );
};
