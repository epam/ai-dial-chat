import { memo, type FC } from 'react';

/** Props for `ItemGradients`. */
export interface ItemGradientsProps {
  /** `id` of the gradient that paints an active glyph; referenced as `url(#id)`. */
  activeGradientId: string;
}

/**
 * Paint server for the active item's glyph: a blue-to-violet gradient mapped
 * onto the 24×24 Tabler viewBox. `display: none` would drop it, so it is
 * zero-sized instead.
 */
export const ItemGradients: FC<ItemGradientsProps> = memo(
  ({ activeGradientId }) => (
    <svg aria-hidden className="absolute size-0" focusable="false">
      <defs>
        <linearGradient
          id={activeGradientId}
          gradientUnits="userSpaceOnUse"
          x1="31.3"
          y1="-1.7"
          x2="0.2"
          y2="20.4"
        >
          <stop offset="0" stopColor="#1d4ed8" />
          <stop offset="1" stopColor="#885df2" />
        </linearGradient>
      </defs>
    </svg>
  ),
);
