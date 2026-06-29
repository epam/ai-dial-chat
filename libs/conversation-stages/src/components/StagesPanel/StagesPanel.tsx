import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import type { StagesPanelProps } from '../../models/stages-props';
import { StageItem } from '../StageItem/StageItem';
import styles from './StagesPanel.module.scss';

/**
 * Displays an agent's accumulated stages as a collapsible list.
 * Renders above the assistant message bubble during and after streaming.
 */
export const StagesPanel: FC<StagesPanelProps> = ({
  stages,
  isStreaming,
  className,
  styles: panelStyles,
  copyAriaLabel,
  onAttachmentClick,
}) => {
  const { colors, typography = { fontClassName: 'dial-small-text' } } =
    panelStyles ?? {};

  const cssVars = buildCssVars({
    '--cs-bg': colors?.background,
    '--cs-border': colors?.border,
    '--cs-text': colors?.text,
    '--cs-stage-text': colors?.stageTextColor,
    '--cs-running': colors?.runningColor,
    '--cs-completed': colors?.completedColor,
    '--cs-failed': colors?.failedColor,
    '--cs-button-bg': colors?.buttonBackground,
  });

  const lastRunningStageIndex = isStreaming
    ? stages.reduce<number>((lastIndex, stage, index) => {
        if (!stage.status) {
          return index;
        }
        return lastIndex;
      }, -1)
    : -1;

  return (
    <div
      style={cssVars}
      className={mergeClasses('w-full', styles.panel, className)}
    >
      <ul role="list" className="flex w-full flex-col gap-4">
        {stages.map((stage, index) => (
          <li
            key={stage.index}
            role="listitem"
            className={mergeClasses('w-full', typography.fontClassName)}
          >
            <StageItem
              stage={stage}
              isLive={lastRunningStageIndex === index}
              typography={typography}
              copyAriaLabel={copyAriaLabel}
              onAttachmentClick={onAttachmentClick}
            />
          </li>
        ))}
      </ul>
    </div>
  );
};
