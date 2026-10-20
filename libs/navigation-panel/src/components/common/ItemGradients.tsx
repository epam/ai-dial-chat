import type { FC } from 'react';
import styles from './ItemGradients.module.scss';

/** Props for `ItemGradients`. */
export interface ItemGradientsProps {
  /** `id` of the gradient that paints an active glyph; referenced as `url(#id)`. */
  activeGradientId: string;
}

/**
 * Paint server for the active item's glyph: a gradient mapped onto the 24×24
 * Tabler viewBox, colored by `--np-sidebar-gradient-start` and `-end`.
 * `display: none` would drop it, so it is zero-sized instead.
 */
export const ItemGradients: FC<ItemGradientsProps> = ({ activeGradientId }) => (
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
        <stop offset="0" className={styles.stopStart} />
        <stop offset="1" className={styles.stopEnd} />
      </linearGradient>
    </defs>
  </svg>
);
