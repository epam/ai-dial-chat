import {
  buildCssVars,
  mergeClasses,
  StageStatus,
} from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { FC, useState } from 'react';
import type {
  StagesPanelProps,
  StageTypography,
} from '../../models/stages-props';
import type { GroupedStageRow } from '../../utils/stage-grouping';
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
  row: GroupedStageRow;
  isLive: boolean;
  typography: StageTypography;
  copyAriaLabel?: string;
  runningAriaLabel?: string;
  failedAriaLabel?: string;
  attemptLabel: (attemptNumber: number) => string;
}

/**
 * Renders a collapsed `×N` group: one summary row (name, attempt count,
 * total duration) that expands to the individual attempts. Not exported —
 * an implementation detail of how `StagesPanel` renders a `GroupedStageRow`.
 */
const StageGroupRow: FC<StageGroupRowProps> = ({
  row,
  isLive,
  typography,
  copyAriaLabel,
  runningAriaLabel,
  failedAriaLabel,
  attemptLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const hasFailed = row.attempts.some((a) => a.status === StageStatus.Failed);
  const totalSeconds = row.attempts.reduce((sum, attempt) => {
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
          'flex w-full items-center gap-2 px-2 py-1.5 text-start',
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
            typography.fontClassName,
            styles.stageName,
            hasFailed && styles.stageNameFailed,
          )}
        >
          <DialEllipsisTooltip text={row.name} />
        </span>
        <span
          className={mergeClasses('dial-tiny-text flex-none', styles.count)}
        >
          ×{row.attempts.length}
        </span>
        {totalDurationLabel && (
          <span
            className={mergeClasses(
              'dial-tiny-text flex-none',
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
            {row.attempts.map((attempt, i) => (
              <li key={attempt.index} role="listitem">
                <StageItem
                  stage={attempt}
                  nameOverride={attemptLabel(i + 1)}
                  isLive={
                    isLive &&
                    attempt.index ===
                      row.attempts[row.attempts.length - 1].index
                  }
                  typography={typography}
                  copyAriaLabel={copyAriaLabel}
                  runningAriaLabel={runningAriaLabel}
                  failedAriaLabel={failedAriaLabel}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

/**
 * Displays an agent's accumulated stages as a flat, inline list of rows — no
 * card, border, or panel around it. Repeated identical stage names collapse
 * into one `×N` row that expands to the individual attempts.
 */
export const StagesPanel: FC<StagesPanelProps> = ({
  stages,
  isStreaming,
  className,
  styles: panelStyles,
  labels,
}) => {
  const {
    colors,
    typography = {
      fontClassName: 'dial-small-text',
      contentClassName: 'dial-tiny-text',
    },
  } = panelStyles ?? {};
  const {
    copyAriaLabel,
    runningAriaLabel,
    failedAriaLabel,
    attemptLabel = (n: number) => `Attempt ${n}`,
  } = labels ?? {};
  const cssVars = buildCssVars({
    '--cs-text': colors?.text,
    '--cs-row-hover': colors?.rowHoverColor,
    '--cs-stage-text': colors?.stageTextColor,
    '--cs-failed-text': colors?.failedColor,
  });

  const liveStage = isStreaming ? findLiveStage(stages) : undefined;
  const rows = groupStagesByName(stages);

  /*
   * ps-5 (20px) + the row's own px-2 (8px) puts each row icon's left edge at
   * 28px — the same x as the CollapsedGroup toggle's "Executed" label text
   * (its 8px button padding + a 16px check icon + a 4px gap), so a row's
   * icon lines up under the summary's label, not its icon.
   */
  return (
    <div
      style={cssVars}
      className={mergeClasses('w-full', styles.panel, className)}
    >
      <ul role="list" className="flex w-full flex-col gap-0.5 ps-5">
        {rows.map((row) =>
          row.kind === 'single' ? (
            <li key={row.key} role="listitem">
              <StageItem
                stage={row.stage}
                isLive={liveStage?.index === row.stage.index}
                typography={typography}
                copyAriaLabel={copyAriaLabel}
                runningAriaLabel={runningAriaLabel}
                failedAriaLabel={failedAriaLabel}
              />
            </li>
          ) : (
            <li key={row.key} role="listitem">
              <StageGroupRow
                row={row}
                isLive={
                  liveStage?.index ===
                  row.attempts[row.attempts.length - 1].index
                }
                typography={typography}
                copyAriaLabel={copyAriaLabel}
                runningAriaLabel={runningAriaLabel}
                failedAriaLabel={failedAriaLabel}
                attemptLabel={attemptLabel}
              />
            </li>
          ),
        )}
      </ul>
    </div>
  );
};
