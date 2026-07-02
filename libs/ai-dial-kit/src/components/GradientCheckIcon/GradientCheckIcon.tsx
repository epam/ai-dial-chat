import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { type FC } from 'react';

/** Props for the {@link GradientCheckIcon} component. */
export interface GradientCheckIconProps {
  /**
   * Unique id for the SVG `linearGradient` element.
   * Must be unique per document if multiple instances can render simultaneously.
   * Defaults to `'gradient-check-icon'`.
   */
  gradientId?: string;
}

/** Checkmark icon rendered with a blue-to-purple gradient stroke. */
export const GradientCheckIcon: FC<GradientCheckIconProps> = ({
  gradientId = 'gradient-check-icon',
}) => (
  <svg
    width={DIAL_ICON_SIZE.SM}
    height={DIAL_ICON_SIZE.SM}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <defs>
      <linearGradient
        id={gradientId}
        x1="0"
        y1="0"
        x2="24"
        y2="24"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stopColor="#4b7be6" />
        <stop offset="100%" stopColor="#9355f4" />
      </linearGradient>
    </defs>
    <path
      d="M5 12l5 5L20 7"
      stroke={`url(#${gradientId})`}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
