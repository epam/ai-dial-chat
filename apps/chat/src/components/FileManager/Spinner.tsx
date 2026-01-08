import React from 'react';

import classNames from 'classnames';

export interface DialSpinnerProps {
  size?: number;
  borderWidth?: number;
  particleLength?: number;
  animationDurationSec?: number;
  circleClassName?: string;
  particleClassName?: string;
  className?: string;
  icon?: React.ReactNode;
}

/**
 * DialSpinner is a customizable circular loader with a rotating particle
 * and an optional center icon.
 *
 * @param size - Overall size of the spinner in pixels.
 * @param borderWidth - Width of the outer circle and particle stroke in pixels.
 * @param particleLength - Length of the rotating particle as a fraction of the circle (0–1).
 * @param animationDurationSec - Duration of one full rotation in seconds.
 * @param circleClassName - Tailwind class controlling the outer circle color.
 * @param particleClassName - Tailwind class controlling the rotating particle color.
 * @param className - Additional Tailwind classes applied to the root container.
 * @param icon - Optional icon rendered in the center of the spinner.
 *
 * @example
 * ```tsx
 * <DialSpinner
 *   size={72}
 *   circleClassName="text-secondary"
 *   particleClassName="text-accent-primary"
 *   icon={<IconLoader size={20} className="text-primary" />}
 * />
 * ```
 */
export const DialSpinner: React.FC<DialSpinnerProps> = ({
  size = 64,
  borderWidth = 5,
  particleLength = 0.2,
  animationDurationSec = 1.2,
  circleClassName = 'text-primary',
  particleClassName = 'text-accent-primary',
  className,
  icon,
}) => {
  const radius = (size - borderWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const particleStroke = circumference * particleLength;
  const gapStroke = circumference - particleStroke;

  return (
    <div
      className={classNames(
        'relative flex items-center justify-center',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute animate-spin"
        style={{ animationDuration: `${animationDurationSec}s` }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={borderWidth}
          fill="none"
          className={circleClassName}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={borderWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${particleStroke} ${gapStroke}`}
          className={particleClassName}
        />
      </svg>
      {icon && (
        <div className="relative z-10 flex items-center justify-center">
          {icon}
        </div>
      )}
    </div>
  );
};
