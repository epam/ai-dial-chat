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
import type { CollapsedGroupProps } from '../../models/CollapsedGroup';
import { StagesPanel } from '../StagesPanel/StagesPanel';
import styles from './CollapsedGroup.module.scss';

/**
 * Renders streaming stages directly via StagesPanel, or collapses completed
 * stages behind an expandable toggle while keeping active stages always visible.
 */
export const CollapsedGroup: FC<CollapsedGroupProps> = ({
  stages,
  isStreaming,
  executedLabel = 'Executed',
  stepsLabel = () => 'steps',
  className,
  styles: groupStyles,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isStreaming) {
    return <StagesPanel stages={stages} isStreaming />;
  }

  const { colors, typography = { fontClassName: 'dial-tiny-text' } } =
    groupStyles ?? {};
  const cssVars = buildCssVars({
    '--cs-cg-label': colors?.labelColor,
    '--cs-cg-label-hover': colors?.labelHoverColor,
    '--cs-cg-steps-count': colors?.stepsCountColor,
    '--cs-cg-border': colors?.contentBorderColor,
  });

  const completedStages = stages.filter(
    (s) => s.status === StageStatus.Completed,
  );
  const activeStages = stages.filter((s) => s.status !== StageStatus.Completed);

  return (
    <div
      style={cssVars}
      className={mergeClasses('flex flex-col gap-1', className)}
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
                  className={mergeClasses(typography.fontClassName, 'pr-1')}
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
            className={[
              'grid pt-1 transition-[grid-template-rows] duration-300 ease-in-out',
              isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            ].join(' ')}
          >
            <div className="overflow-hidden">
              <div
                className={mergeClasses(
                  'rounded border px-2 py-3',
                  styles.contentBox,
                )}
              >
                <StagesPanel stages={completedStages} isStreaming={false} />
              </div>
            </div>
          </div>
        </div>
      )}
      {activeStages.length > 0 && (
        <StagesPanel stages={activeStages} isStreaming={false} />
      )}
    </div>
  );
};
