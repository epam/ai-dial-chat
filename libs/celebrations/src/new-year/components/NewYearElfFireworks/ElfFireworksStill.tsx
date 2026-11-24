import type { FC } from 'react';
import {
  BURST_COLORS,
  ELF_FIREWORKS_PALETTE as P,
  ROCKET_COLORS,
} from '../../utils/elf-fireworks-art';
import { GiftElf } from '../NewYearGiftWrapping/GiftWrappingArt';

const RAYS = Array.from({ length: 12 }, (_, i) => (i * 360) / 12);

/** An elf cheering under one frozen burst beside his rocket sack; no player, no borrowed controls. */
export const ElfFireworksStill: FC = () => (
  <svg viewBox="0 0 220 150" focusable="false" data-elf-fireworks-static>
    <g transform="translate(150 42)" strokeLinecap="round">
      <circle r="26" fill={BURST_COLORS[0][0]} opacity="0.25" />
      {RAYS.map((angle, i) => (
        <path
          key={angle}
          d={i % 2 ? 'M14 0H22' : 'M18 0H30'}
          transform={`rotate(${angle})`}
          stroke={BURST_COLORS[0][i % 2]}
          strokeWidth="3"
        />
      ))}
    </g>
    <g stroke={P.ink} strokeWidth="1.4" strokeLinejoin="round">
      <g transform="translate(176 140)">
        <path d="M-10 -32L-19 -14L-17 0H17L19 -14L10 -32Z" fill={P.sack} />
        <path d="M-11 -31H11" stroke={P.rope} strokeWidth="3" />
        <path d="M2 -33L7 -45L12 -33Z" fill={P.paper} />
      </g>
      <g transform="translate(118 140) scale(.85)">
        <path
          d="M-6 -16L-12 -1L-6 -5ZM6 -16L12 -1L6 -5Z"
          fill={ROCKET_COLORS[1]}
        />
        <rect
          x="-6"
          y="-36"
          width="12"
          height="30"
          rx="3"
          fill={ROCKET_COLORS[1]}
        />
        <path d="M-6 -35L0 -46L6 -35Z" fill={P.paper} />
      </g>
    </g>
    <g transform="translate(70 140) scale(.85)">
      <GiftElf />
    </g>
  </svg>
);
