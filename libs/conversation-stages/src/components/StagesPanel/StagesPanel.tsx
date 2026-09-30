import {
  buildCssVars,
  mergeClasses,
  StageStatus,
} from '@epam/ai-dial-chat-shared';
import { Accordion, EllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import { CONVERSATION_STAGES_CLASS } from '../../constants/public-class-names';
import {
  STAGE_ACCORDION_CLASS_NAME,
  STAGE_ACCORDION_HEADER_CLASS_NAME,
} from '../../constants/stage-accordion';
import { StageRow } from '../../models/stage-grouping';
import type {
  StagesPanelLabels,
  StagesPanelProps,
  StageTypography,
} from '../../models/stages-props';
import { groupStagesByName } from '../../utils/stage-grouping';
import {
  calculateStagesDurationSeconds,
  formatTotalDuration,
} from '../../utils/stage-name';
import { StageIcon } from '../StageIcon/StageIcon';
import { StageItem } from '../StageItem/StageItem';
import styles from './StagesPanel.module.scss';

interface StageGroupRowProps {
  /** The collapsed `×N` group to render. */
  row: StageRow;
  /** Whether this stage group contains the currently executing (live) stage. */
  isLive: boolean;
  /** Typography configuration applied to stage text elements. */
  typography?: StageTypography;
  /** User-visible strings. */
  labels?: StagesPanelLabels;
  /** Called when a stage attachment tile is clicked/activated. See {@link StagesPanelProps.onAttachmentClick}. */
  onAttachmentClick?: StagesPanelProps['onAttachmentClick'];
}

/** Expandable summary row for a collapsed `×N` group of identical stage attempts. */
const StageGroupRow: FC<StageGroupRowProps> = ({
  row,
  isLive,
  typography,
  labels,
  onAttachmentClick,
}) => {
  const {
    runningAriaLabel,
    failedAriaLabel,
    attemptLabel = (n: number) => `Attempt ${n}`,
  } = labels ?? {};
  const hasUnresolved = row.attempts?.some((a) => a.status == null) ?? false;
  const hasFailed = row.attempts?.some((a) => a.status === StageStatus.Failed);
  const groupStatus = hasUnresolved
    ? null
    : hasFailed
      ? StageStatus.Failed
      : StageStatus.Completed;
  const totalSeconds = calculateStagesDurationSeconds(
    (row.attempts || []).map((attempt) => attempt.name),
  );
  const totalDurationLabel =
    totalSeconds > 0 ? formatTotalDuration(totalSeconds) : undefined;

  const header = (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex flex-none items-center">
        <StageIcon
          status={groupStatus}
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
          hasFailed && styles.stageNameFailed,
        )}
      >
        <EllipsisTooltip text={row.name} />
      </span>
      <span
        className={mergeClasses(
          'flex-none',
          typography?.countFontClassName ?? 'dial-tiny-text',
          styles.count,
        )}
      >
        ×{row.attempts?.length ?? 0}
      </span>
      {totalDurationLabel && (
        <span
          className={mergeClasses(
            'flex-none',
            typography?.countFontClassName ?? 'dial-tiny-text',
            styles.duration,
          )}
        >
          {totalDurationLabel}
        </span>
      )}
    </span>
  );

  /* `-mt-2` turns the kit's 12px spacer into the 4px the attempts list has
     always sat below its summary row. */
  return (
    <Accordion
      title={header}
      className={STAGE_ACCORDION_CLASS_NAME}
      headerClassName={mergeClasses(
        STAGE_ACCORDION_HEADER_CLASS_NAME,
        styles.collapseButton,
        styles.row,
        styles.stageHeader,
      )}
      contentClassName={mergeClasses('-mt-2 px-0 ps-6', styles.stageRegion)}
    >
      <ul role="list" className="flex flex-col gap-0.5">
        {row.attempts?.map((attempt, i) => (
          <li key={attempt.index} role="listitem">
            <StageItem
              stage={attempt}
              nameOverride={attemptLabel(i + 1)}
              isLive={isLive && attempt.status == null}
              typography={typography}
              labels={labels}
              onAttachmentClick={onAttachmentClick}
            />
          </li>
        ))}
      </ul>
    </Accordion>
  );
};

/** Flat inline list of agent stages; repeated identical names collapse into a ×N group row. */
export const StagesPanel: FC<StagesPanelProps> = ({
  stages,
  isStreaming,
  className,
  styles: panelStyles,
  labels,
  onAttachmentClick,
}) => {
  const { colors, typography } = panelStyles ?? {};

  const cssVars = buildCssVars({
    '--cs-text': colors?.text,
    '--cs-row-hover': colors?.rowHoverColor,
    '--cs-button-bg': colors?.collapsedButtonBg,
    '--cs-stage-text': colors?.stageTextColor,
    '--cs-failed-text': colors?.failedColor,
    '--cs-tag-text': colors?.tagTextColor,
    '--cs-count-text': colors?.countTextColor,
    '--cs-duration-text': colors?.durationTextColor,
    '--cs-icon-secondary': colors?.iconSecondaryColor,
    '--cs-icon-completed': colors?.iconCompletedColor,
    '--cs-icon-error': colors?.iconErrorColor,
    '--cs-code-bg': colors?.codeBg,
    '--cs-code-border': colors?.codeBorderColor,
    '--cs-code-text': colors?.codeTextColor,
    '--cs-border': colors?.borderColor,
  });

  const rows = groupStagesByName(stages);

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'w-full',
        styles.panel,
        className,
        CONVERSATION_STAGES_CLASS.panel,
      )}
    >
      <ul role="list" className="flex w-full flex-col gap-0.5 ps-5">
        {rows.map((row) =>
          row.stage ? (
            <li key={row.key} role="listitem">
              <StageItem
                stage={row.stage}
                isLive={isStreaming && row.stage.status == null}
                typography={typography}
                labels={labels}
                onAttachmentClick={onAttachmentClick}
              />
            </li>
          ) : (
            <li key={row.key} role="listitem">
              <StageGroupRow
                row={row}
                isLive={
                  isStreaming &&
                  (row.attempts?.some((attempt) => attempt.status == null) ??
                    false)
                }
                typography={typography}
                labels={labels}
                onAttachmentClick={onAttachmentClick}
              />
            </li>
          ),
        )}
      </ul>
    </div>
  );
};
