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
        <path
          d="M2 -46C5.7 -45.94 13.64 -33.7 17.64 -31C21.64 -28.3 41.08 -20.5 42 -19C42.92 -17.5 30.49 -16.12 26.88 -16C23.27 -15.88 10.33 -17.86 5.88 -17.8C1.43 -17.74 -12.85 -15.22 -17.64 -15.4C-22.43 -15.58 -41.83 -17.98 -42 -19.6C-42.17 -21.22 -23.72 -28.96 -19.32 -31.6C-14.92 -34.24 -1.7 -46.06 2 -46Z"
          fill={P.fir}
          stroke={P.firDark}
        />
        <path
          d="M2 -70C4.82 -69.94 10.44 -57.7 13.44 -55C16.44 -52.3 31.3 -44.5 32 -43C32.7 -41.5 23.23 -40.12 20.48 -40C17.73 -39.88 7.87 -41.86 4.48 -41.8C1.09 -41.74 -9.79 -39.22 -13.44 -39.4C-17.09 -39.58 -31.87 -41.98 -32 -43.6C-32.13 -45.22 -18.12 -52.96 -14.72 -55.6C-11.32 -58.24 -0.82 -70.06 2 -70Z"
          fill={P.fir}
          stroke={P.firDark}
        />
        <path
          d="M2 -92C3.94 -91.94 7.24 -79.7 9.24 -77C11.24 -74.3 21.52 -66.5 22 -65C22.48 -63.5 15.97 -62.12 14.08 -62C12.19 -61.88 5.41 -63.86 3.08 -63.8C0.75 -63.74 -6.73 -61.22 -9.24 -61.4C-11.75 -61.58 -21.91 -63.98 -22 -65.6C-22.09 -67.22 -12.52 -74.96 -10.12 -77.6C-7.72 -80.24 0.06 -92.06 2 -92Z"
          fill={P.fir}
          stroke={P.firDark}
        />
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
        <circle cx="0" cy="-33" r="28" fill="#ffffff" />
        <path
          d="M25.76 -41.96C26.33 -39.71 27.51 -26.43 25.76 -22.36C24.01 -18.29 15.5 -9.89 11.2 -8.08C6.9 -6.27 -5.68 -5.46 -10.08 -7.24C-14.48 -9.02 -25.95 -21.91 -25.48 -22.92C-25.01 -23.93 -11.13 -15.04 -6.16 -15.64C-1.19 -16.24 12.7 -24.9 15.96 -27.96C19.22 -31.02 19.82 -39.44 21 -41.12C22.18 -42.8 25.19 -44.21 25.76 -41.96Z"
          fill={P.shadow}
          stroke="none"
        />
        <circle cx="0" cy="-75" r="20" fill="#ffffff" />
        <path
          d="M18.4 -81.4C18.81 -79.79 19.65 -70.3 18.4 -67.4C17.15 -64.5 11.07 -58.5 8 -57.2C4.93 -55.9 -4.06 -55.33 -7.2 -56.6C-10.34 -57.87 -18.54 -67.08 -18.2 -67.8C-17.86 -68.52 -7.95 -62.17 -4.4 -62.6C-0.85 -63.03 9.07 -69.22 11.4 -71.4C13.73 -73.58 14.16 -79.6 15 -80.8C15.84 -82 17.99 -83.01 18.4 -81.4Z"
          fill={P.shadow}
          stroke="none"
        />
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
        <circle cx="0" cy="-107" r="15" fill="#ffffff" />
        <path
          d="M13.8 -111.8C14.11 -110.59 14.74 -103.48 13.8 -101.3C12.86 -99.12 8.3 -94.62 6 -93.65C3.7 -92.68 -3.04 -92.25 -5.4 -93.2C-7.76 -94.15 -13.9 -101.06 -13.65 -101.6C-13.4 -102.14 -5.96 -97.38 -3.3 -97.7C-0.64 -98.02 6.8 -102.66 8.55 -104.3C10.3 -105.94 10.62 -110.45 11.25 -111.35C11.88 -112.25 13.49 -113.01 13.8 -111.8Z"
          fill={P.shadow}
          stroke="none"
        />
        <path
          d="M12-111L30-107L12-105Z"
          fill={P.carrot}
          stroke="#a24d0e"
          strokeWidth="1"
        />
        <ellipse
          cx="3.5"
          cy="-111"
          rx="1.9"
          ry="2.1"
          fill={P.coal}
          stroke="none"
        />
        <ellipse
          cx="10.5"
          cy="-111"
          rx="1.9"
          ry="2.1"
          fill={P.coal}
          stroke="none"
        />
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
