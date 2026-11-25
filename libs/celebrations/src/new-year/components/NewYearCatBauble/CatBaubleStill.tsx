import type { FC } from 'react';
import {
  BAUBLE_COLORS,
  CAT_BAUBLE_PALETTE as P,
} from '../../utils/cat-bauble-art';

/** The cat sitting under the fir, admiring a new ornament on the hook; no player, no borrowed controls. */
export const CatBaubleStill: FC = () => (
  <svg viewBox="0 0 232 160" focusable="false" data-cat-bauble-static>
    <g stroke={P.ink} strokeWidth="1.3" strokeLinejoin="round">
      <g transform="translate(172 150) scale(1.35)">
        <rect x="-4.5" y="-18" width="9" height="18" rx="1" fill={P.trunk} />
        <path
          d="M-37 -20L-16 -38L-6 -54L6 -54L16 -38L37 -20L22 -17L0 -19L-22 -17Z"
          fill={P.fir}
          stroke={P.firDark}
        />
        <path
          d="M-27 -48L-12 -64L-4 -80L4 -80L12 -64L27 -48L16 -46L0 -47L-16 -46Z"
          fill={P.fir}
          stroke={P.firDark}
        />
        <path
          d="M-18 -73L-8 -88L-1 -104L3 -104L8 -88L18 -73L10 -71L0 -72L-10 -71Z"
          fill={P.fir}
          stroke={P.firDark}
        />
        <path
          d="M0 -112L2 -107L7.5 -106.5L3.3 -103L4.6 -97.5L0 -100.4L-4.6 -97.5L-3.3 -103L-7.5 -106.5L-2 -107Z"
          fill={P.star}
          strokeWidth="0.8"
        />
        <circle cx="-36" cy="-13.5" r="4.5" fill={BAUBLE_COLORS[0]} />
        <circle cx="36" cy="-13.5" r="4.2" fill={BAUBLE_COLORS[1]} />
        <circle cx="-17" cy="-68" r="3.8" fill={BAUBLE_COLORS[2]} />
        <path d="M-26 -51V-46" stroke={P.hook} />
        <rect
          x="-40"
          y="-46"
          width="28"
          height="13"
          rx="6.5"
          fill={P.white}
          strokeWidth="1"
        />
        <path d="M-34 -39.5H-18" stroke={P.furShade} strokeWidth="1.6" />
      </g>
      <g
        transform="translate(58 150) scale(1.05)"
        stroke={P.outline}
        strokeWidth="0.9"
      >
        <path
          d="M-27 -30C-38 -38 -40 -52 -34 -66"
          fill="none"
          stroke={P.fur}
          strokeWidth="6.2"
          strokeLinecap="round"
        />
        <ellipse cx="0" cy="-27" rx="26" ry="15.5" fill={P.fur} />
        <ellipse cx="20" cy="-23" rx="7" ry="9" fill={P.white} stroke="none" />
        <rect
          x="11"
          y="-26"
          width="9.5"
          height="26"
          rx="4.7"
          fill={P.fur}
          stroke="none"
        />
        <rect
          x="21"
          y="-26"
          width="9.5"
          height="26"
          rx="4.7"
          fill={P.fur}
          stroke="none"
        />
        <g transform="rotate(-18 22 -36)">
          <path d="M18 -57L21 -73L29 -62Z" fill={P.fur} />
          <path d="M33 -63L42 -71L43 -56Z" fill={P.fur} />
          <ellipse cx="31" cy="-51" rx="15.5" ry="13.5" fill={P.fur} />
          <ellipse cx="38" cy="-44" rx="5.5" ry="3.8" fill={P.white} />
          <ellipse
            cx="29.5"
            cy="-44.5"
            rx="2.75"
            ry="1.4"
            fill={P.blush}
            stroke="none"
          />
          <path
            d="M36.6 -43.4Q37.2 -42.2 38.2 -43.4Q39.2 -42.2 40 -43.4"
            fill="none"
            stroke={P.ink}
            strokeWidth="0.7"
          />
          <ellipse
            cx="26.5"
            cy="-51.5"
            rx="3.75"
            ry="4"
            fill={P.eye}
            stroke="none"
          />
          <ellipse
            cx="36.5"
            cy="-52"
            rx="3.75"
            ry="4"
            fill={P.eye}
            stroke="none"
          />
          <ellipse
            cx="27.1"
            cy="-51.5"
            rx="2.2"
            ry="2.7"
            fill={P.pupil}
            stroke="none"
          />
          <ellipse
            cx="37.1"
            cy="-52"
            rx="2.2"
            ry="2.7"
            fill={P.pupil}
            stroke="none"
          />
          <circle cx="26.1" cy="-53.2" r="1" fill={P.white} stroke="none" />
          <circle cx="36.1" cy="-53.7" r="1" fill={P.white} stroke="none" />
        </g>
        <path d="M17 -38L27 -33" stroke={P.collar} strokeWidth="3" />
        <circle cx="25" cy="-30" r="3" fill={P.bell} stroke="none" />
      </g>
    </g>
  </svg>
);
