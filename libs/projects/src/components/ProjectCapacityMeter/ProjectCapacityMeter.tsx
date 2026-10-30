import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  ElementSize,
  ProgressBar,
  ProgressBarRole,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { getCapacityPercent } from '../../utils/context-files';
import styles from './ProjectCapacityMeter.module.scss';

/** Props for {@link ProjectCapacityMeter}. */
export interface ProjectCapacityMeterProps {
  /** Bytes taken by the context files. */
  usedBytes: number;
  /** Capacity in bytes. */
  maxBytes: number;
  /** Accessible name of the meter. */
  ariaLabel: string;
  /** Visible and announced value text for a percentage. */
  formatLabel: (percent: number) => string;
  /** CSS class applied to the value text. Defaults to `'dial-tiny-text'`. */
  textClassName?: string;
}

/** Kit `ProgressBar` in its `meter` role showing how much of the project context capacity is used. */
export const ProjectCapacityMeter: FC<ProjectCapacityMeterProps> = ({
  usedBytes,
  maxBytes,
  ariaLabel,
  formatLabel,
  textClassName = 'dial-tiny-text',
}) => {
  if (usedBytes <= 0) return null;

  const percent = getCapacityPercent(usedBytes, maxBytes);
  const label = formatLabel(percent);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <ProgressBar
        role={ProgressBarRole.Meter}
        value={usedBytes}
        max={maxBytes}
        size={ElementSize.Small}
        aria-label={ariaLabel}
        aria-valuetext={label}
        className={mergeClasses('w-[60px] shrink-0', styles.track)}
      />
      <span
        aria-hidden
        className={mergeClasses(
          'whitespace-nowrap',
          textClassName,
          styles.text,
        )}
      >
        {label}
      </span>
    </div>
  );
};
