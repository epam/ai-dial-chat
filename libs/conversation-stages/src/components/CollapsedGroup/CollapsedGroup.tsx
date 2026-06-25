import {
  buildCssVars,
  mergeClasses,
  StageStatus,
} from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialLinkButton } from '@epam/ai-dial-ui-kit';
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
} from '@tabler/icons-react';
import { FC, useState } from 'react';
import type { CollapsedGroupProps } from '../../models/collapsed-group';
import { StagesPanel } from '../StagesPanel/StagesPanel';
import styles from './CollapsedGroup.module.scss';

/**
 * Shows all stages when there are fewer than `collapseThreshold`. When there are `collapseThreshold` or more,
 * completed stages are collapsed behind an expandable toggle while active
 * stages remain always visible.
 */
export const CollapsedGroup: FC<CollapsedGroupProps> = ({
  stages,
  isStreaming,
  executedLabel = 'Executed',
  stepsLabel = () => 'steps',
  collapseThreshold = 7,
  className,
  styles: groupStyles,
  onAttachmentClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isStreaming) {
    return (
      <StagesPanel
        stages={stages}
        isStreaming
        onAttachmentClick={onAttachmentClick}
      />
    );
  }

  const { colors, typography = { fontClassName: 'dial-tiny-text' } } =
    groupStyles ?? {};
  const noCustomFont = !typography.fontClassName;
  const cssVars = buildCssVars({
    '--cs-cg-label': colors?.labelColor,
    '--cs-cg-label-hover': colors?.labelHoverColor,
    '--cs-cg-steps-count': colors?.stepsCountColor,
    '--cs-cg-border': colors?.contentBorderColor,
    '--cs-cg-font-family': noCustomFont ? typography.fontFamily : undefined,
  });

  if (stages.length < collapseThreshold) {
    return (
      <div
        style={cssVars}
        className={mergeClasses('flex w-full flex-col gap-1', className)}
      >
        <StagesPanel
          stages={stages}
          isStreaming={false}
          onAttachmentClick={onAttachmentClick}
        />
      </div>
    );
  }

  const completedStages = stages.filter(
    (s) => s.status === StageStatus.Completed,
  );
  const activeStages = stages.filter((s) => s.status !== StageStatus.Completed);

  return (
    <div
      style={cssVars}
      className={mergeClasses('flex w-full flex-col gap-1', className)}
    >
      {completedStages.length > 0 && (
        <div>
          <DialLinkButton
            className={styles.toggleButton}
            onClick={() => setIsExpanded((prev) => !prev)}
            iconBefore={<IconCheck size={DIAL_ICON_SIZE.SM} />}
            iconAfter={
              isExpanded ? (
                <IconChevronDown size={12} />
              ) : (
                <IconChevronRight size={12} className="rtl:scale-x-[-1]" />
              )
            }
            label={
              <>
                <span
                  className={mergeClasses(typography.fontClassName, 'pe-1')}
                >
                  {executedLabel}
                </span>
                <span
                  className={mergeClasses(
                    typography.fontClassName,
                    styles.stepsCount,
                  )}
                >
                  {completedStages.length} {stepsLabel(completedStages.length)}
                </span>
              </>
            }
          />
          <div
            className={mergeClasses(
              'grid pt-1 transition-[grid-template-rows] duration-300 ease-in-out',
              isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="overflow-hidden">
              <div
                className={mergeClasses(
                  'rounded border px-2 py-3',
                  styles.contentBox,
                )}
              >
                <StagesPanel
                  stages={completedStages}
                  isStreaming={false}
                  onAttachmentClick={onAttachmentClick}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {activeStages.length > 0 && (
        <StagesPanel
          stages={activeStages}
          isStreaming={false}
          onAttachmentClick={onAttachmentClick}
        />
      )}
    </div>
  );
};
