import {
  buildCssVars,
  mergeClasses,
  StageStatus,
} from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, LinkButton, Spinner } from '@epam/ai-dial-ui-kit';
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
} from '@tabler/icons-react';
import { FC, useEffect, useRef, useState } from 'react';
import type { CollapsedGroupProps } from '../../models/collapsed-group';
import {
  cleanStageName,
  formatTotalDuration,
  parseDurationSeconds,
} from '../../utils/stage-name';
import { findLiveStage, stagePosition } from '../../utils/stage-progress';
import { StagesPanel } from '../StagesPanel/StagesPanel';
import styles from './CollapsedGroup.module.scss';

/** Wraps `StagesPanel` with a collapsible summary line that tracks run state: live progress while streaming, one-line summary once finished. */
export const CollapsedGroup: FC<CollapsedGroupProps> = ({
  stages,
  isStreaming,
  labels,
  className,
  styles: groupStyles,
}) => {
  const {
    executedLabel = 'Executed',
    stepsLabel = () => 'steps',
    failedCountLabel = (n: number) => `${n} failed`,
    runningStepLabel = (current: number, total: number) =>
      `Step ${current} of ${total}`,
    runningAriaLabel = 'Running',
    copyAriaLabel,
    failedAriaLabel,
    attemptLabel,
  } = labels ?? {};

  const [isOpen, setIsOpen] = useState(isStreaming);
  const wasStreamingRef = useRef(isStreaming);
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      // The run just finished — collapse to the one-line summary.
      setIsOpen(false);
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const { colors, panel: panelColors } = groupStyles ?? {};

  const summaryTypography = groupStyles?.typography ?? {
    fontClassName: 'dial-small-text',
  };
  const cssVars = buildCssVars({
    '--cs-cg-label': colors?.labelColor,
    '--cs-cg-label-hover': colors?.labelHoverColor,
    '--cs-cg-steps-count': colors?.stepsCountColor,
    '--cs-cg-done': colors?.doneColor,
    '--cs-cg-failed': colors?.failedColor,
    '--cs-text': panelColors?.text,
    '--cs-row-hover': panelColors?.rowHoverColor,
    '--cs-button-bg': panelColors?.collapsedButtonBg,
    '--cs-stage-text': panelColors?.stageTextColor,
    '--cs-failed-text': panelColors?.failedColor,
    '--cs-tag-text': panelColors?.tagTextColor,
    '--cs-count-text': panelColors?.countTextColor,
    '--cs-duration-text': panelColors?.durationTextColor,
    '--cs-icon-secondary': panelColors?.iconSecondaryColor,
    '--cs-icon-completed': panelColors?.iconCompletedColor,
    '--cs-icon-error': panelColors?.iconErrorColor,
    '--cs-code-bg': panelColors?.codeBg,
    '--cs-code-border': panelColors?.codeBorderColor,
    '--cs-code-text': panelColors?.codeTextColor,
    '--cs-border': panelColors?.borderColor,
  });

  if (stages.length === 0) return null;

  const panelLabels = {
    copyAriaLabel,
    runningAriaLabel,
    failedAriaLabel,
    attemptLabel,
  };

  if (stages.length === 1) {
    return (
      <StagesPanel
        stages={stages}
        isStreaming={isStreaming}
        className={className}
        styles={{ colors: panelColors, typography: groupStyles?.typography }}
        labels={panelLabels}
      />
    );
  }

  const hasFailed = stages.some((s) => s.status === StageStatus.Failed);
  const totalSeconds = stages.reduce((sum, stage) => {
    const { durationLabel } = cleanStageName(stage.name);
    return sum + (parseDurationSeconds(durationLabel) ?? 0);
  }, 0);
  const totalDurationLabel =
    totalSeconds > 0 ? formatTotalDuration(totalSeconds) : undefined;

  const liveStage = isStreaming ? findLiveStage(stages) : undefined;

  let summary;
  if (isStreaming) {
    const position = liveStage
      ? stagePosition(stages, liveStage)
      : stages.length;
    const liveName = liveStage ? cleanStageName(liveStage.name).name : '';
    summary = (
      <span
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-2"
      >
        <Spinner size={14} ariaLabel={runningAriaLabel} />
        <span
          className={mergeClasses(
            summaryTypography.fontClassName,
            styles.liveName,
          )}
        >
          {runningStepLabel(position, stages.length)}
        </span>
        {liveName && (
          <span
            className={mergeClasses(
              summaryTypography.fontClassName,
              styles.executedLabel,
            )}
          >
            {liveName}
          </span>
        )}
      </span>
    );
  } else if (hasFailed) {
    const failedCount = stages.filter(
      (s) => s.status === StageStatus.Failed,
    ).length;
    summary = (
      <span className="inline-flex items-center gap-1">
        <span
          className={mergeClasses(
            summaryTypography.fontClassName,
            styles.executedLabel,
          )}
        >
          {executedLabel} {stages.length} {stepsLabel(stages.length)}
        </span>
        <span
          className={mergeClasses(
            summaryTypography.fontClassName,
            styles.failedText,
          )}
        >
          {failedCountLabel(failedCount)}
        </span>
        {totalDurationLabel && (
          <span
            className={mergeClasses(
              summaryTypography.fontClassName,
              styles.stepsCount,
            )}
          >
            {totalDurationLabel}
          </span>
        )}
      </span>
    );
  } else {
    summary = (
      <span className="inline-flex items-center gap-1">
        <IconCheck
          size={DIAL_ICON_SIZE.SM}
          className={styles.doneIcon}
          aria-hidden
        />
        <span
          className={mergeClasses(
            summaryTypography.fontClassName,
            styles.executedLabel,
          )}
        >
          {executedLabel} {stages.length} {stepsLabel(stages.length)}
        </span>
        {totalDurationLabel && (
          <span
            className={mergeClasses(
              summaryTypography.fontClassName,
              styles.stepsCount,
            )}
          >
            {totalDurationLabel}
          </span>
        )}
      </span>
    );
  }

  return (
    <div
      style={cssVars}
      className={mergeClasses('flex w-full flex-col gap-1', className)}
    >
      <LinkButton
        className={styles.toggleButton}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        iconAfter={
          isOpen ? (
            <IconChevronDown size={12} aria-hidden />
          ) : (
            <IconChevronRight
              size={12}
              className="rtl:scale-x-[-1]"
              aria-hidden
            />
          )
        }
        label={summary}
      />
      <div
        className={mergeClasses(
          'grid transition-[grid-template-rows] duration-300 ease-in-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <StagesPanel
            stages={stages}
            isStreaming={isStreaming}
            styles={{
              colors: panelColors,
              typography: groupStyles?.typography,
            }}
            labels={panelLabels}
            className="pt-1"
          />
        </div>
      </div>
    </div>
  );
};
