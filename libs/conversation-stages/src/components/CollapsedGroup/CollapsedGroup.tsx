import {
  buildCssVars,
  mergeClasses,
  StageStatus,
} from '@epam/ai-dial-chat-shared';
import {
  Accordion,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  EllipsisTooltip,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconCheck } from '@tabler/icons-react';
import { FC, useEffect, useRef, useState } from 'react';
import { CONVERSATION_STAGES_CLASS } from '../../constants/public-class-names';
import type { CollapsedGroupProps } from '../../models/collapsed-group';
import {
  calculateStagesDurationSeconds,
  cleanStageName,
  formatTotalDuration,
} from '../../utils/stage-name';
import { findLiveStage } from '../../utils/stage-progress';
import { StagesPanel } from '../StagesPanel/StagesPanel';
import styles from './CollapsedGroup.module.scss';

/** Wraps `StagesPanel` with a collapsible summary line that tracks run state: live progress while streaming, one-line summary once finished. */
export const CollapsedGroup: FC<CollapsedGroupProps> = ({
  stages,
  isStreaming,
  labels,
  className,
  styles: groupStyles,
  onAttachmentClick,
}) => {
  const {
    executedLabel = 'Executed',
    stepsLabel = () => 'steps',
    failedCountLabel = (n: number) => `${n} failed`,
    runningAriaLabel = 'Running',
    copyAriaLabel,
    failedAriaLabel,
    attemptLabel,
    attachmentClickLabel,
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
    attachmentClickLabel,
  };

  if (stages.length === 1) {
    return (
      <StagesPanel
        stages={stages}
        isStreaming={isStreaming}
        className={className}
        styles={{ colors: panelColors, typography: groupStyles?.typography }}
        labels={panelLabels}
        onAttachmentClick={onAttachmentClick}
      />
    );
  }

  const hasFailed = stages.some((s) => s.status === StageStatus.Failed);
  const totalSeconds = calculateStagesDurationSeconds(
    stages.map((stage) => stage.name),
  );
  const totalDurationLabel =
    totalSeconds > 0 ? formatTotalDuration(totalSeconds) : undefined;

  let summary;
  if (isStreaming) {
    /* No "Step X of Y" counter: agents add stages mid-run, so the total keeps
       growing and misleads users about how close the run is to finishing
       (issue #9025). Between one stage settling and the next starting, keep
       the last stage's name on screen. */
    const liveStage = findLiveStage(stages) ?? stages[stages.length - 1];
    const liveName = cleanStageName(liveStage.name).name;
    summary = (
      <span
        role="status"
        aria-live="polite"
        className="flex min-w-0 items-center gap-2"
      >
        <span className="flex flex-none items-center">
          <Spinner size={14} ariaLabel={runningAriaLabel} />
        </span>
        {liveName && (
          <span
            className={mergeClasses(
              'min-w-0 max-w-[22rem] truncate',
              summaryTypography.fontClassName,
              styles.liveName,
            )}
          >
            <EllipsisTooltip text={liveName} />
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
          stroke={DIAL_KIT_ICON_STROKE}
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
      className={mergeClasses(
        'flex w-full flex-col gap-1',
        className,
        CONVERSATION_STAGES_CLASS.group,
      )}
    >
      {/* `-mt-2` turns the kit's 12px spacer, plus the panel's `pt-1`, into
          the 8px the stages have always sat below the summary line. */}
      <Accordion
        title={summary}
        expanded={isOpen}
        onToggle={setIsOpen}
        className="overflow-visible py-0"
        headerClassName={mergeClasses(
          'justify-start gap-1 rounded-none px-0',
          styles.toggleButton,
          CONVERSATION_STAGES_CLASS.groupToggle,
        )}
        contentClassName={mergeClasses('-mt-2 px-0', styles.groupRegion)}
      >
        {isOpen && (
          <StagesPanel
            stages={stages}
            isStreaming={isStreaming}
            styles={{
              colors: panelColors,
              typography: groupStyles?.typography,
            }}
            labels={panelLabels}
            className="pt-1"
            onAttachmentClick={onAttachmentClick}
          />
        )}
      </Accordion>
    </div>
  );
};
