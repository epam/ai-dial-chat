import {
  buildCssVars,
  mergeClasses,
  StageStatus,
} from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { FC, useState } from 'react';
import { StageRow } from '../../models/stage-grouping';
import type {
  StagesPanelLabels,
  StagesPanelProps,
  StageTypography,
} from '../../models/stages-props';
import { groupStagesByName } from '../../utils/stage-grouping';
import {
  cleanStageName,
  formatTotalDuration,
  parseDurationSeconds,
} from '../../utils/stage-name';
import { findLiveStage } from '../../utils/stage-progress';
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
}

/** Expandable summary row for a collapsed `×N` group of identical stage attempts. */
const StageGroupRow: FC<StageGroupRowProps> = ({
  row,
  isLive,
  typography,
  labels,
}) => {
  const {
    runningAriaLabel,
    failedAriaLabel,
    attemptLabel = (n: number) => `Attempt ${n}`,
  } = labels ?? {};
  const [isOpen, setIsOpen] = useState(false);

  const hasFailed = row.attempts?.some((a) => a.status === StageStatus.Failed);
  const totalSeconds = (row.attempts || []).reduce((sum, attempt) => {
    const { durationLabel } = cleanStageName(attempt.name);
    return sum + (parseDurationSeconds(durationLabel) ?? 0);
  }, 0);
  const totalDurationLabel =
    totalSeconds > 0 ? formatTotalDuration(totalSeconds) : undefined;

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className={mergeClasses(
          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start',
          styles.collapseButton,
          styles.row,
        )}
      >
        <span className="flex flex-none items-center">
          <StageIcon
            status={hasFailed ? StageStatus.Failed : StageStatus.Completed}
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
          <DialEllipsisTooltip text={row.name} />
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
        <span className={mergeClasses('flex-none', styles.iconSecondary)}>
          {isOpen ? (
            <IconChevronDown size={DIAL_ICON_SIZE.SM} aria-hidden />
          ) : (
            <IconChevronRight
              size={DIAL_ICON_SIZE.SM}
              className="rtl:scale-x-[-1]"
              aria-hidden
            />
          )}
        </span>
      </button>
      <div
        className={mergeClasses(
          'grid overflow-hidden transition-[grid-template-rows] duration-[250ms] ease-in-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <ul role="list" className="mt-1 flex flex-col gap-0.5 ps-6">
            {row.attempts?.map((attempt, i) => (
              <li key={attempt.index} role="listitem">
                <StageItem
                  stage={attempt}
                  nameOverride={attemptLabel(i + 1)}
                  isLive={
                    isLive &&
                    attempt.index ===
                      row.attempts?.[row.attempts.length - 1]?.index
                  }
                  typography={typography}
                  labels={labels}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

/** Flat inline list of agent stages; repeated identical names collapse into a ×N group row. */
export const StagesPanel: FC<StagesPanelProps> = ({
  stages,
  isStreaming,
  className,
  styles: panelStyles,
  labels,
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

  const liveStage = isStreaming ? findLiveStage(stages) : undefined;
  const rows = groupStagesByName(stages);

  return (
    <div
      style={cssVars}
      className={mergeClasses('w-full', styles.panel, className)}
    >
      <ul role="list" className="flex w-full flex-col gap-0.5 ps-5">
        {rows.map((row) =>
          row.stage ? (
            <li key={row.key} role="listitem">
              <StageItem
                stage={row.stage}
                isLive={liveStage?.index === row.stage.index}
                typography={typography}
                labels={labels}
              />
            </li>
          ) : (
            <li key={row.key} role="listitem">
              <StageGroupRow
                row={row}
                isLive={
                  liveStage?.index ===
                  row.attempts?.[row.attempts.length - 1].index
                }
                typography={typography}
                labels={labels}
              />
            </li>
          ),
        )}
      </ul>
    </div>
  );
};
