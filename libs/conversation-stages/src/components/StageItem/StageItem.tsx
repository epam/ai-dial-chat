import type { Stage } from '@epam/ai-dial-chat-shared';
import { mergeClasses, StageStatus } from '@epam/ai-dial-chat-shared';
import { Accordion, EllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import {
  STAGE_ACCORDION_CLASS_NAME,
  STAGE_ACCORDION_HEADER_CLASS_NAME,
} from '../../constants/stage-accordion';
import type {
  StagesPanelLabels,
  StageTypography,
} from '../../models/stages-props';
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
}

/** Renders a single stage row, optionally expandable to show its content. */
export const StageItem: FC<StageItemProps> = ({
  stage,
  isLive,
  typography,
  labels,
  nameOverride,
}) => {
  const {
    copyAriaLabel = 'Copy stage content',
    runningAriaLabel,
    failedAriaLabel,
  } = labels ?? {};
  const { name: cleanedName, durationLabel } = cleanStageName(stage.name);
  const displayName = nameOverride ?? cleanedName;
  const isMono = !nameOverride && isIdentifierLike(cleanedName);
  const isFailed = stage.status === StageStatus.Failed;

  const hasExpandableContent = !!stage.content;

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
     the stage content has always sat below its row. */
  return (
    <Accordion
      title={<span className="flex min-w-0 items-center gap-2">{header}</span>}
      className={STAGE_ACCORDION_CLASS_NAME}
      headerClassName={mergeClasses(
        STAGE_ACCORDION_HEADER_CLASS_NAME,
        styles.row,
        styles.stageHeader,
      )}
      contentClassName={mergeClasses(
        '-mt-1 flex flex-col gap-3 px-0 py-1 ps-8',
        styles.stageRegion,
      )}
    >
      <div className="max-h-[300px] overflow-y-auto">
        <StageMarkdownContent
          content={stage.content ?? ''}
          typography={typography}
          copyAriaLabel={copyAriaLabel}
        />
      </div>
    </Accordion>
  );
};
