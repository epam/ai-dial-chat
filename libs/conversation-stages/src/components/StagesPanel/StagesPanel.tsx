import { mergeClasses, StageStatus } from '@epam/ai-dial-chat-shared';
import type { Stage } from '@epam/ai-dial-chat-shared';
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconLoader2,
  IconX,
} from '@tabler/icons-react';
import { CSSProperties, FC, KeyboardEvent, useState } from 'react';
import type { StagesPanelProps } from '../../models/StagesPanel.js';
import styles from './StagesPanel.module.scss';

/** Maps a stage status to the appropriate icon element. */
const StageIcon: FC<{ status: Stage['status'] }> = ({ status }) => {
  if (status === null) {
    return (
      <IconLoader2
        size={14}
        className={mergeClasses('animate-spin', styles.iconRunning)}
      />
    );
  }
  if (status === StageStatus.Completed) {
    return <IconCheck size={14} className={styles.iconCompleted} />;
  }
  return <IconX size={14} className={styles.iconFailed} />;
};

/**
 * Displays an agent's accumulated stages as a collapsible list.
 * Renders above the assistant message bubble during and after streaming.
 */
export const StagesPanel: FC<StagesPanelProps> = ({
  stages,
  defaultOpen = true,
  headerLabel = 'Steps',
  toggleAriaLabel = 'Toggle steps panel',
  className,
  colors,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const cssVars = {
    ...(colors?.background && { '--cs-bg': colors.background }),
    ...(colors?.border && { '--cs-border': colors.border }),
    ...(colors?.text && { '--cs-text': colors.text }),
    ...(colors?.stageTextColor && { '--cs-stage-text': colors.stageTextColor }),
    ...(colors?.runningColor && { '--cs-running': colors.runningColor }),
    ...(colors?.completedColor && { '--cs-completed': colors.completedColor }),
    ...(colors?.failedColor && { '--cs-failed': colors.failedColor }),
  } as CSSProperties;

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div
      style={cssVars}
      className={mergeClasses('w-full', styles.panel, className)}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-label={toggleAriaLabel}
        className={mergeClasses(
          'flex cursor-pointer select-none items-center gap-2 px-3 py-2',
          styles.header,
        )}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
      >
        {isOpen ? (
          <IconChevronDown size={14} />
        ) : (
          <IconChevronRight size={14} />
        )}
        <span className="font-medium">{headerLabel}</span>
        <span className="ml-auto text-xs opacity-60">{stages.length}</span>
      </div>

      {isOpen && (
        <ul
          role="list"
          className={mergeClasses('border-t px-3 py-2', styles.divider)}
        >
          {stages.map((stage) => (
            <li
              key={stage.index}
              role="listitem"
              className="flex items-center gap-2 py-1"
            >
              <StageIcon status={stage.status} />
              <span className={mergeClasses('truncate', styles.stageName)}>
                {stage.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
