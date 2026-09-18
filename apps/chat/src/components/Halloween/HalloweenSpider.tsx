import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { memo } from 'react';

interface Props {
  className?: string;
}

/**
 * A single decorative spider, drawn inline so it inherits the theme's tokens
 * and needs no asset request. Hangs head-up, which suits both places it is
 * used: the bottom of an abseiling thread in `HalloweenBurstOverlay`, and
 * perched on a corner cobweb in `HalloweenDecor`.
 *
 * The legs are two-segment polylines with the knee above the body, which is
 * what reads as a spider rather than a sun; body and legs use control tokens
 * rather than a literal grey, so it keeps its contrast when the surface flips
 * between the light and dark theme.
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
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13.5 13 L7 7.5 L2.5 11" />
      <path d="M13 16.5 L5.5 13.5 L0.8 17.5" />
      <path d="M13 20 L5.5 20.5 L1.5 25" />
      <path d="M14 23.5 L8.5 26 L6 31" />
      <path d="M26.5 13 L33 7.5 L37.5 11" />
      <path d="M27 16.5 L34.5 13.5 L39.2 17.5" />
      <path d="M27 20 L34.5 20.5 L38.5 25" />
      <path d="M26 23.5 L31.5 26 L34 31" />
    </g>
    <ellipse
      cx="20"
      cy="20"
      rx="7.5"
      ry="8"
      className="fill-control-inverted"
    />
    {/* A pale hourglass marking and a highlight, so the abdomen is not a
        featureless blob at the size this renders. */}
    <path
      d="M17.5 16 L22.5 16 L18.5 20 L22.5 24 L17.5 24 L21.5 20 Z"
      className="fill-control-permanent opacity-40"
    />
    <ellipse
      cx="17.4"
      cy="16.4"
      rx="1.8"
      ry="2.4"
      transform="rotate(-25 17.4 16.4)"
      className="fill-control-permanent opacity-25"
    />
    <circle cx="20" cy="10" r="4.8" className="fill-control-inverted" />
    <circle cx="18" cy="8.8" r="1.2" className="fill-control-permanent" />
    <circle cx="22" cy="8.8" r="1.2" className="fill-control-permanent" />
    <circle cx="16.6" cy="10.8" r="0.7" className="fill-control-permanent" />
    <circle cx="23.4" cy="10.8" r="0.7" className="fill-control-permanent" />
  </svg>
);

export default memo(HalloweenSpider);
