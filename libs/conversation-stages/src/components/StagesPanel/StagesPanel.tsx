import type { Stage } from '@epam/ai-dial-chat-shared';
import { buildCssVars, mergeClasses, StageStatus } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialSpinner } from '@epam/ai-dial-ui-kit';
import { IconAlertCircle, IconCircleCheck } from '@tabler/icons-react';
import { FC } from 'react';
import type { StagesPanelProps } from '../../models/StagesPanel.js';
import styles from './StagesPanel.module.scss';

/** Maps a stage status to the appropriate icon element. */
const StageIcon: FC<{ status: Stage['status'] }> = ({ status }) => {
  if (!status) {
    return <DialSpinner />;
  }
  if (status === StageStatus.Completed) {
    return (
      <IconCircleCheck
        size={DIAL_ICON_SIZE.MD}
        className={styles.iconSecondary}
      />
    );
  }
  return (
    <IconAlertCircle
      size={DIAL_ICON_SIZE.MD}
      className={styles.iconSecondary}
    />
  );
};

/**
 * Displays an agent's accumulated stages as a collapsible list.
 * Renders above the assistant message bubble during and after streaming.
 */
export const StagesPanel: FC<StagesPanelProps> = ({
  stages,
  className,
  colors,
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
      <ul role="list" className="py-2">
        {stages.map((stage) => (
          <li
            key={stage.index}
            role="listitem"
            className="flex items-center gap-2 py-1"
          >
            <StageIcon status={stage.status} />
            <span
              className={mergeClasses('truncate capitalize', styles.stageName)}
            >
              {stage.name || stage.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
