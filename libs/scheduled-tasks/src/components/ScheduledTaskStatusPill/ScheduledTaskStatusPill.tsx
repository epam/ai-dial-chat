import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconCheck, IconPlayerPause } from '@tabler/icons-react';
import type { FC } from 'react';
import { ScheduledTaskStatus } from '../../types/scheduled-task-status';
import styles from './ScheduledTaskStatusPill.module.scss';

/*
 * Per-status presentation: the schedule pill renders as a rounded-lg block
 * with no icon; the Paused/Completed badges render as rounded-full pills with
 * their glyph. Enum-keyed, so adding a status member without a config entry
 * fails to compile.
 */
const STATUS_PRESENTATION: Record<
  ScheduledTaskStatus,
  {
    /** Structural Tailwind classes for the pill shape. */
    pillClassName: string;
    /** Module class setting the pill's background and border color. */
    wrapperClassName: string;
    /** Module class setting the pill's text color. */
    labelClassName: string;
    /** Optional icon rendered before the pill text. */
    renderIcon?: () => React.JSX.Element;
  }
> = {
  [ScheduledTaskStatus.Scheduled]: {
    pillClassName: 'inline-block rounded-lg border px-2 py-1',
    wrapperClassName: styles.schedulePill,
    labelClassName: styles.scheduleLabel,
  },
  [ScheduledTaskStatus.Paused]: {
    pillClassName:
      'inline-flex items-center gap-1.5 rounded-full border px-2 py-1',
    wrapperClassName: styles.pausedPill,
    labelClassName: styles.pausedLabel,
    renderIcon: () => (
      <IconPlayerPause
        size={DIAL_ICON_SIZE.SM}
        aria-hidden
        stroke={DIAL_KIT_ICON_STROKE}
      />
    ),
  },
  [ScheduledTaskStatus.Completed]: {
    pillClassName:
      'inline-flex items-center gap-1.5 rounded-full border px-2 py-1',
    wrapperClassName: styles.completedPill,
    labelClassName: styles.completedLabel,
    renderIcon: () => (
      <IconCheck
        size={DIAL_ICON_SIZE.SM}
        aria-hidden
        stroke={DIAL_KIT_ICON_STROKE}
      />
    ),
  },
};

/** Props for the internal `ScheduledTaskStatusPill` rendered by `ScheduledTaskCard`. */
interface ScheduledTaskStatusPillProps {
  /** Pre-resolved visual status — selects the pill shape and icon. */
  status: ScheduledTaskStatus;
  /** Pill text: the schedule label, or the badge label from the card's `labels`. */
  text: string;
  /** Typography class applied to the pill root. Defaults to `'dial-tiny-text'`. */
  textClassName?: string;
  /** Additional CSS class applied to the pill root. */
  className?: string;
}

/*
 * The single status element a card renders in its status row: the schedule
 * pill for an upcoming schedule, or the Paused/Completed badge that replaces
 * it. Internal to `ScheduledTaskCard` — not re-exported from the package.
 */
export const ScheduledTaskStatusPill: FC<ScheduledTaskStatusPillProps> = ({
  status,
  text,
  textClassName = 'dial-tiny-text',
  className,
}) => {
  const { pillClassName, wrapperClassName, labelClassName, renderIcon } =
    STATUS_PRESENTATION[status];

  return (
    <span
      className={mergeClasses(
        pillClassName,
        textClassName,
        wrapperClassName,
        labelClassName,
        className,
      )}
    >
      {renderIcon && renderIcon()}
      {text}
    </span>
  );
};
