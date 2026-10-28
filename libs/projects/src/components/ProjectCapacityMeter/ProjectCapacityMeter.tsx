import { mergeClasses } from '@epam/ai-dial-chat-shared';
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

/** `role="meter"` bar showing how much of the project context capacity is used. */
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
    <div className="flex flex-col gap-1">
      <div
        role="meter"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={maxBytes}
        aria-valuenow={Math.min(usedBytes, maxBytes)}
        aria-valuetext={label}
        className={mergeClasses(
          'h-1 w-full overflow-hidden rounded-full',
          styles.track,
        )}
      >
        <div
          className={mergeClasses('h-full rounded-full', styles.fill)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span aria-hidden className={mergeClasses(textClassName, styles.text)}>
        {label}
      </span>
    </div>
  );
};
