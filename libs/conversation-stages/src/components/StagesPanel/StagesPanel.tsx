import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import type { StagesPanelProps } from '../../models/StagesPanel.js';
import { StageItem } from '../StageItem/StageItem.js';
import styles from './StagesPanel.module.scss';

/**
 * Displays an agent's accumulated stages as a collapsible list.
 * Renders above the assistant message bubble during and after streaming.
 */
export const StagesPanel: FC<StagesPanelProps> = ({
  stages,
  className,
  colors,
  typographyClassName = 'dial-small-text',
}) => {
  const cssVars = buildCssVars({
    '--cs-bg': colors?.background,
    '--cs-border': colors?.border,
    '--cs-text': colors?.text,
    '--cs-stage-text': colors?.stageTextColor,
    '--cs-running': colors?.runningColor,
    '--cs-completed': colors?.completedColor,
    '--cs-failed': colors?.failedColor,
  });

  return (
    <div
      style={cssVars}
      className={mergeClasses('w-full', styles.panel, className)}
    >
      <ul role="list" className="flex flex-col gap-4">
        {stages.map((stage) => (
          <li key={stage.index} role="listitem" className={typographyClassName}>
            <StageItem
              stage={stage}
              typographyClassName={typographyClassName}
            />
          </li>
        ))}
      </ul>
    </div>
  );
};
