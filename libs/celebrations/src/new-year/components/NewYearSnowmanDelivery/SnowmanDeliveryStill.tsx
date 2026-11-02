import type { FC } from 'react';
import { SNOWMAN_PALETTE as P } from '../../utils/snowman-delivery-art';

/** The delivered present beside a snowman who holds his head on firmly; no player, no borrowed controls. */
export const SnowmanDeliveryStill: FC = () => (
  <svg viewBox="0 0 220 150" focusable="false" data-snowman-static>
    <g stroke={P.ink} strokeWidth="1.4">
      <path
        d="M8 141H212"
        stroke={P.shadow}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <g transform="translate(170 140)">
        <path d="M-4 0V-14H4V0Z" fill={P.trunk} strokeWidth="1" />
        <path d="M0-46L40-14H-40Z" fill={P.fir} stroke={P.firDark} />
        <path d="M0-70L32-40H-32Z" fill={P.fir} stroke={P.firDark} />
        <path d="M0-92L22-62H-22Z" fill={P.fir} stroke={P.firDark} />
        <circle cx="-8" cy="-38" r="2.6" fill={P.bauble} stroke="none" />
        <circle cx="9" cy="-56" r="2.6" fill={P.bauble} stroke="none" />
      </g>
      <g transform="translate(130 140)">
        <rect
          x="-11"
          y="-18"
          width="22"
          height="18"
          rx="1.5"
          fill={P.present}
        />
        <path
          d="M-2-18H2V0H-2ZM-11-11H11V-7H-11Z"
          fill={P.ribbon}
          stroke="none"
        />
        <path
          d="M0-18L-7-24L-5-17ZM0-18L7-24L5-17Z"
          fill={P.ribbon}
          strokeWidth="0.8"
        />
      </g>
      <g transform="translate(70 140)">
        <ellipse cx="-10" cy="-3" rx="9" ry="4" fill="#e8eef8" />
        <ellipse cx="11" cy="-3" rx="9" ry="4" fill="#e8eef8" />
        <circle cx="0" cy="-33" r="28" fill="#eef3fb" />
        <path
          d="M-12-14A26 26 0 0 0 20-12A30 30 0 0 1-12-14Z"
          fill={P.shadow}
          stroke="none"
        />
        <circle cx="0" cy="-75" r="20" fill="#eef3fb" />
        <circle cx="7" cy="-82" r="1.7" fill={P.coal} stroke="none" />
        <circle cx="9" cy="-72" r="1.7" fill={P.coal} stroke="none" />
        <rect
          x="-20"
          y="-93.5"
          width="40"
          height="9"
          rx="4.5"
          fill={P.scarf}
          stroke={P.scarfDark}
          strokeWidth="1"
        />
        <path
          d="M-4-88L-1-88L1-66L-5-64Z"
          fill={P.scarf}
          stroke={P.scarfDark}
          strokeWidth="1"
        />
        <circle cx="0" cy="-107" r="15" fill="#eef3fb" />
        <path
          d="M12-111L30-107L12-105Z"
          fill={P.carrot}
          stroke="#a24d0e"
          strokeWidth="1"
        />
        <circle cx="4" cy="-111" r="1.7" fill={P.coal} stroke="none" />
        <circle cx="10" cy="-111" r="1.7" fill={P.coal} stroke="none" />
        <path
          d="M1-118L6-120M8-120L13-118"
          fill="none"
          stroke={P.coal}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M3-101L8-98L12-101"
          fill="none"
          stroke={P.coal}
          strokeLinecap="round"
        />
        <path
          d="M5-80L-12-100M-5-82L-20-103"
          fill="none"
          stroke={P.twig}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <ellipse
          cx="-15"
          cy="-104"
          rx="5.5"
          ry="5"
          fill={P.mitten}
          strokeWidth="1"
        />
        <ellipse
          cx="15"
          cy="-104"
          rx="5.5"
          ry="5"
          fill={P.mitten}
          strokeWidth="1"
        />
        <path
          d="M-5-82L15-104"
          fill="none"
          stroke={P.twig}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </g>
    </g>
  </svg>
);
