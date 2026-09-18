import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { memo } from 'react';

interface Props {
  className?: string;
}

/**
 * A single decorative spider, drawn inline so it inherits the theme's tokens
 * and needs no asset request. Hangs head-up at the bottom of its thread — see
 * `HalloweenBurstOverlay`, which owns the thread and the drop animation, and
 * marks the whole layer `aria-hidden`.
 *
 * Body and legs use control tokens rather than a literal grey, so the spider
 * keeps its contrast when the surface flips between the light and dark theme.
 */
const HalloweenSpider: FC<Props> = ({ className }) => (
  <svg
    viewBox="0 0 40 34"
    className={mergeClasses('h-8 w-auto drop-shadow-sm', className)}
    aria-hidden="true"
    focusable="false"
  >
    <g
      className="stroke-primary"
      fill="none"
      strokeWidth="1.4"
      strokeLinecap="round"
    >
      <path d="M13 14 Q6 10 3 15" />
      <path d="M13 17 Q5 16 1 22" />
      <path d="M13 20 Q6 22 4 28" />
      <path d="M14 23 Q10 28 9 32" />
      <path d="M27 14 Q34 10 37 15" />
      <path d="M27 17 Q35 16 39 22" />
      <path d="M27 20 Q34 22 36 28" />
      <path d="M26 23 Q30 28 31 32" />
    </g>
    <ellipse cx="20" cy="19" rx="7" ry="8" className="fill-control-inverted" />
    <circle cx="20" cy="9.5" r="4.5" className="fill-control-inverted" />
    <circle cx="18" cy="8.5" r="1.1" className="fill-control-permanent" />
    <circle cx="22" cy="8.5" r="1.1" className="fill-control-permanent" />
  </svg>
);

export default memo(HalloweenSpider);
