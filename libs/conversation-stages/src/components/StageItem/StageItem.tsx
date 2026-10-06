import { AttachmentCard } from '@epam/ai-dial-attachment-input';
import type { DisplayAttachment, Stage } from '@epam/ai-dial-chat-shared';
import { mergeClasses, StageStatus } from '@epam/ai-dial-chat-shared';
import { Accordion, EllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { FC, ReactNode, useCallback, useMemo, useState } from 'react';
import {
  STAGE_ACCORDION_CLASS_NAME,
  STAGE_ACCORDION_HEADER_CLASS_NAME,
} from '../../constants/stage-accordion';
import type {
  StagesPanelLabels,
  StageTypography,
} from '../../models/stages-props';
import { mapStageAttachmentsToDisplay } from '../../utils/stage-attachments';
import { cleanStageName, isIdentifierLike } from '../../utils/stage-name';
import { StageIcon } from '../StageIcon/StageIcon';
import { StageMarkdownContent } from '../StageMarkdownContent/StageMarkdownContent';
import styles from '../StagesPanel/StagesPanel.module.scss';

/** Props for {@link StageItem}. */
export interface StageItemProps {
  /** The stage data to render. */
  stage: Stage;
  /** Whether this stage is the currently executing (live) stage. */
  isLive: boolean;
  /** Typography configuration applied to stage text elements. */
  typography?: StageTypography;
  /** User-visible strings. */
  labels?: StagesPanelLabels;
  /** Overrides the displayed name; used to relabel individual attempts (e.g. `'Attempt 2'`) inside a `×N` group. */
  nameOverride?: string;
  /** Called when a stage attachment tile is clicked/activated. Receives the mapped display attachment. */
  onAttachmentClick?: (attachment: DisplayAttachment) => void;
  /** Nested list of this stage's child stages, rendered after its own markdown and attachments. Makes the row expandable on its own. */
  childList?: ReactNode;
  /** Controlled expanded state of the disclosure; uncontrolled (initially collapsed) when omitted. The body mounts only while expanded. */
  isExpanded?: boolean;
  /** Called with the next expanded state when the disclosure header is toggled. */
  onToggle?: (isExpanded: boolean) => void;
}

/** Props for {@link StageAttachmentRow}. */
interface StageAttachmentRowProps {
  /** The mapped display attachments to render as tiles. */
  attachments: DisplayAttachment[];
  /** Accessible label for each tile's interactive click action. */
  clickLabel?: string;
  /** Called when a tile is clicked/activated. Receives the mapped display attachment. */
  onAttachmentClick?: StageItemProps['onAttachmentClick'];
}

/** Renders a stage's attachments as a wrapping row of attachment tiles. */
const StageAttachmentRow: FC<StageAttachmentRowProps> = ({
  attachments,
  clickLabel,
  onAttachmentClick,
}) => {
  const handleClick = useCallback(
    (id: string) => {
      const attachment = attachments.find((a) => a.id === id);
      if (attachment) onAttachmentClick?.(attachment);
    },
    [attachments, onAttachmentClick],
  );

  return (
    <div role="list" className="flex flex-wrap gap-3">
      {attachments.map((attachment) => (
        <div key={attachment.id} role="listitem">
          <AttachmentCard
            attachment={attachment}
            onClick={onAttachmentClick && handleClick}
            labels={{ clickLabel }}
          />
        </div>
      ))}
    </div>
  );
};

/** Renders a single stage row, optionally expandable to show its content and child stages. */
export const StageItem: FC<StageItemProps> = ({
  stage,
  isLive,
  typography,
  labels,
  nameOverride,
  onAttachmentClick,
  childList,
  isExpanded,
  onToggle,
}) => {
  /* Uncontrolled fallback for a standalone item; panels pass `isExpanded`. */
  const [isLocallyOpen, setIsLocallyOpen] = useState(false);
  const isOpen = isExpanded ?? isLocallyOpen;
  const handleToggle = useCallback(
    (next: boolean) => {
      if (isExpanded === undefined) setIsLocallyOpen(next);
      onToggle?.(next);
    },
    [isExpanded, onToggle],
  );
  const {
    copyAriaLabel = 'Copy stage content',
    codeBlockCopiedLabel,
    tableScrollRegionAriaLabel,
    mathScrollRegionAriaLabel,
    runningAriaLabel,
    failedAriaLabel,
    attachmentClickLabel = 'Preview search result',
  } = labels ?? {};
  const displayAttachments = useMemo(
    () => mapStageAttachmentsToDisplay(stage.attachments),
    [stage.attachments],
  );
  const { name: cleanedName, durationLabel } = cleanStageName(stage.name);
  const displayName = nameOverride ?? cleanedName;
  const isMono = !nameOverride && isIdentifierLike(cleanedName);
  const isFailed = stage.status === StageStatus.Failed;

  const hasOwnContent = !!stage.content || !!stage.attachments?.length;
  const hasExpandableContent = hasOwnContent || childList != null;

  const header = (
    <>
      <span className="flex flex-none items-center">
        <StageIcon
          status={stage.status}
          isLive={isLive}
          runningLabel={runningAriaLabel}
          failedLabel={failedAriaLabel}
        />
      </span>
      <span
        className={mergeClasses(
          'min-w-0 max-w-[22rem] truncate',
          typography?.fontClassName ?? 'dial-small-text',
          styles.stageName,
          isFailed && styles.stageNameFailed,
          isMono && styles.monoName,
        )}
      >
        <EllipsisTooltip text={displayName || stage.status || ''} />
      </span>
      {stage.tag && (
        <span
          className={mergeClasses(
            'flex-none',
            typography?.tagClassName ?? 'dial-tiny-lead-text',
            styles.tag,
          )}
        >
          {stage.tag}
        </span>
      )}
      {durationLabel && (
        <span
          className={mergeClasses(
            'flex-none',
            typography?.countFontClassName ?? 'dial-tiny-text',
            styles.duration,
          )}
        >
          {durationLabel}
        </span>
      )}
    </>
  );

  /* A stage with nothing to reveal is a plain row, not a disclosure. */
  if (!hasExpandableContent) {
    return (
      <div
        className={mergeClasses(
          'flex w-full items-center gap-2 px-2 py-1.5',
          styles.row,
        )}
      >
        {header}
      </div>
    );
  }

  /* The kit spacer above the content is 12px; `-mt-1` brings it to the 8px
     the stage content has always sat below its row. Own output keeps its
     `ps-8` inset; the child list is a sibling of it, so only the child list's
     own (capped) indentation accumulates with depth. */
  return (
    <Accordion
      expanded={isOpen}
      onToggle={handleToggle}
      title={<span className="flex min-w-0 items-center gap-2">{header}</span>}
      className={STAGE_ACCORDION_CLASS_NAME}
      headerClassName={mergeClasses(
        STAGE_ACCORDION_HEADER_CLASS_NAME,
        styles.row,
        styles.stageHeader,
      )}
      contentClassName={mergeClasses(
        '-mt-1 flex min-w-0 flex-col gap-3 px-0 py-1',
        styles.stageRegion,
      )}
    >
      {isOpen && hasOwnContent && (
        <div className="flex min-w-0 flex-col gap-3 ps-8">
          {stage.content && (
            <div className="max-h-[300px] min-w-0 overflow-y-auto">
              <StageMarkdownContent
                content={stage.content}
                typography={typography}
                copyAriaLabel={copyAriaLabel}
                copiedLabel={codeBlockCopiedLabel}
                tableScrollRegionAriaLabel={tableScrollRegionAriaLabel}
                mathScrollRegionAriaLabel={mathScrollRegionAriaLabel}
              />
            </div>
          )}
          {displayAttachments.length > 0 && (
            <StageAttachmentRow
              attachments={displayAttachments}
              clickLabel={attachmentClickLabel}
              onAttachmentClick={onAttachmentClick}
            />
          )}
        </div>
      )}
      {isOpen && childList}
    </Accordion>
  );
};
