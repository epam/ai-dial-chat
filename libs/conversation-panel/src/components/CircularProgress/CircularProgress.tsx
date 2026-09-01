import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { memo, type FC } from 'react';
import classes from './CircularProgress.module.scss';

/** Props accepted by `CircularProgress`. */
export interface CircularProgressProps {
  /** Completion as a percentage, clamped to 0–100. */
  value: number;
  /** Accessible name for the indicator. Required — a bare progressbar tells a screen reader nothing. */
  ariaLabel: string;
  /** Spoken value replacing the bare percentage, e.g. `"3 of 10 attachments"`. */
  ariaValueText?: string;
  /** Outer diameter in pixels. Defaults to `16`. */
  size?: number;
  /** Ring thickness in pixels. Defaults to `2`. */
  strokeWidth?: number;
  /** Extra class name(s) merged onto the root `svg`. */
  className?: string;
}

const VIEWBOX_SIZE = 100;

/**
 * Determinate ring whose filled arc is `value` percent of its circumference,
 * swept clockwise from twelve o'clock.
 *
 * The ring is deliberately not mirrored under `dir="rtl"`: it is a symmetric
 * indicator, and a counter-clockwise sweep reads as work being undone.
 */
export const CircularProgress: FC<CircularProgressProps> = memo(
  ({
    value,
    ariaLabel,
    ariaValueText,
    size = 16,
    strokeWidth = 2,
    className,
  }) => {
    const percent = Math.min(Math.max(value, 0), 100);
    /* Stroke is centred on the path, so the radius has to leave half of it inside the viewBox. */
    const radius = VIEWBOX_SIZE / 2 - strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;

    return (
      <svg
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={ariaValueText}
        width={size}
        height={size}
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        className={mergeClasses('-rotate-90', className)}
      >
        <circle
          cx={VIEWBOX_SIZE / 2}
          cy={VIEWBOX_SIZE / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={classes.track}
        />
        <circle
          cx={VIEWBOX_SIZE / 2}
          cy={VIEWBOX_SIZE / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          className={classes.indicator}
        />
      </svg>
    );
  },
);

CircularProgress.displayName = 'CircularProgress';
