import { AttachmentGroup } from '@epam/ai-dial-attachment-input';
import {
  AttachmentType,
  buildCssVars,
  DeploymentIcon,
  DisplayAttachment,
  MDMessageViewer,
  mergeClasses,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
import { NeutralButton } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import { useInlineStartIndent } from '../../hooks/useInlineStartIndent/useInlineStartIndent';
import type { AssistantMessageBubbleProps } from '../../models/message-bubble';
import { MessageActions } from '../MessageActions/MessageActions';
import styles from './MessageBubble.module.scss';

/*
 * Indents the first markdown block's first line past the overlaid
 * `beforeContent` slot. Scoped through the `cm-bubble-markdown` wrapper class
 * (see its use site) so the indent never lands on host-supplied slot content.
 */
const FIRST_LINE_INDENT_CLASS_NAME =
  '[&>.cm-bubble-markdown>div>*:first-child]:indent-[var(--cm-bubble-first-line-indent,0px)]';

/** Assistant-authored message bubble, start-aligned with markdown content and optional quick-reply starters. */
export const AssistantMessageBubble: FC<AssistantMessageBubbleProps> = ({
  text,
  styles: bubbleStyles,
  actions,
  hasAlwaysVisibleActions,
  isStreaming,
  attachments,
  beforeContent,
  afterContent,
  starters,
  onSelectStarter,
  deploymentIconUrl,
  deploymentDisplayName,
  markdownComponents,
  markdownClassNames,
  markdownUrlTransform,
  onAttachmentClick,
  onDownloadAll,
  onAttachmentRetry,
  codeBlockTheme,
  tableOnOpenInCanvas,
  labels,
  selectedAttachmentId,
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
    tableCopyCsvLabel,
    tableCopyTxtLabel,
    tableCopyMarkdownLabel,
    tableCopiedLabel,
    tableDownloadCsvLabel,
    tableOpenInCanvasLabel,
    tableDownloadFilename,
    tableScrollRegionAriaLabel,
    assistantMessageAriaLabel = 'Assistant message',
    deploymentIconFallbackLabel = 'AI',
  } = labels ?? {};
  const visibleAttachments = isStreaming
    ? (attachments ?? []).filter((a) => a.type !== AttachmentType.Audio)
    : (attachments ?? []);
  const { slotRef, firstLineIndent } = useInlineStartIndent(
    beforeContent != null && !!text,
  );
  const cssVars = buildCssVars({
    '--cm-bubble-text': colors?.text,
    '--cm-starters-divider': colors?.startersDivider,
    '--cm-bubble-first-line-indent': firstLineIndent,
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
          {/*
           * The slot overlays the text's first line from inside the text
           * container — absolutely positioned at the inline-start edge, the
           * first markdown block's first line indented past it via
           * `--cm-bubble-first-line-indent` (the measured slot width plus a
           * gap) — so the text word-flows after it, the conversation input's
           * inline-start slot behaviour. Markdown's first block cannot host
           * the slot inline (it is react-markdown output), and this bubble is
           * full-width, so the out-of-flow overlay costs nothing here. In
           * flow whenever there is no text: on its own line when the message
           * is empty, or above the streaming placeholder while the first
           * token has not arrived yet.
           */}
          {beforeContent != null && !text && (
            <div className="min-w-0">{beforeContent}</div>
          )}
          {(text || isStreaming) && (
            <div
              aria-live="polite"
              aria-atomic="false"
              className={mergeClasses(
                textClass,
                'relative min-w-0 max-w-full text-start',
                /*
                 * `text-indent` inherits, so the indent targets the markdown
                 * container's first block child (a leading list indents its
                 * every item's first line — accepted edge) rather than the
                 * text container, where it would reach every block. The
                 * `cm-bubble-markdown` wrapper class scopes the selector to
                 * the markdown container alone: the slot's overlay div is
                 * also a direct child of the text container, and
                 * host-supplied slot content of any element type must never
                 * receive the indent.
                 */
                beforeContent != null &&
                  text &&
                  FIRST_LINE_INDENT_CLASS_NAME,
              )}
            >
              {beforeContent != null && text && (
                <div ref={slotRef} className="absolute start-0 top-0">
                  {beforeContent}
                </div>
              )}
              {/*
               * The plain marker class (not a CSS-module hash) keeps the
               * indent selector above a static string Tailwind can generate.
               */}
              <div className="cm-bubble-markdown min-w-0 max-w-full">
                <MDMessageViewer
                  content={text ?? ''}
                  isStreaming={isStreaming}
                  thinkingLabel={thinkingLabel}
                  components={markdownComponents}
                  classNames={markdownClassNames}
                  urlTransform={markdownUrlTransform}
                  codeBlockCopyLabel={codeBlockCopyLabel}
                  codeBlockCopiedLabel={codeBlockCopiedLabel}
                  codeBlockTheme={codeBlockTheme}
                  tableActionLabels={{
                    copyCsvLabel: tableCopyCsvLabel,
                    copyTxtLabel: tableCopyTxtLabel,
                    copyMarkdownLabel: tableCopyMarkdownLabel,
                    copiedLabel: tableCopiedLabel,
                    downloadCsvLabel: tableDownloadCsvLabel,
                    openInCanvasLabel: tableOpenInCanvasLabel,
                  }}
                  tableDownloadFilename={tableDownloadFilename}
                  tableOnOpenInCanvas={tableOnOpenInCanvas}
                  tableScrollRegionAriaLabel={tableScrollRegionAriaLabel}
                />
              </div>
            </div>
          )}
          <AttachmentGroup
            attachments={visibleAttachments}
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
            selectedAttachmentId={selectedAttachmentId}
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
                <NeutralButton
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
