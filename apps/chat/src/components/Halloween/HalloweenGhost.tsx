import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { memo, useId } from 'react';
import { HalloweenGhostVariant } from '../../types/halloween';

/* Translucent cloth silhouettes share one lighting treatment. */
const GHOSTS: Record<
  HalloweenGhostVariant,
  { body: string; face: string; tint: string }
> = {
  [HalloweenGhostVariant.Classic]: {
    body: 'M32 4C17 4 9 16 10 32C12 54 8 65 3 79Q14 76 21 82Q27 88 34 78Q40 70 45 79Q53 87 62 77C50 65 57 47 55 29C54 14 46 4 32 4Z',
    face: 'M23 34a4 5 0 1 0 0 .1Zm18 0a4 5 0 1 0 0 .1ZM32 52a5 4 0 0 0 5-4h-10a5 4 0 0 0 5 4Z',
    tint: '#c7bbef',
  },
  [HalloweenGhostVariant.Tall]: {
    body: 'M32 3C21 3 15 14 16 29C19 49 16 71 9 85Q24 80 28 84Q34 89 38 80Q44 76 54 84C45 61 51 43 49 27C48 12 43 3 32 3Z',
    face: 'M22 33h8a1 1 0 0 1 0 2h-8a1 1 0 0 1 0-2Zm12 0h8a1 1 0 0 1 0 2h-8a1 1 0 0 1 0-2ZM28 50h8a1 1 0 0 1 0 2h-8a1 1 0 0 1 0-2Z',
    tint: '#b4dce7',
  },
  [HalloweenGhostVariant.Blob]: {
    body: 'M32 8C14 8 5 21 7 38C9 55 8 68 2 79Q14 85 23 74Q28 72 32 80Q39 89 47 77Q54 75 63 79C56 63 61 48 58 34C55 17 47 8 32 8Z',
    face: 'M22 38a5 6 0 1 0 0 .1Zm20 0a5 6 0 1 0 0 .1ZM32 56a6 7 0 1 0 0 .1Z',
    tint: '#e2cdb0',
  },
  [HalloweenGhostVariant.Sprite]: {
    body: 'M32 14C21 14 15 23 16 35C18 54 13 65 9 77Q18 82 26 73Q32 69 36 77Q45 84 53 73C42 60 48 47 46 32C45 21 42 14 32 14Z',
    face: 'M23 41a3 4 0 1 0 0 .1Zm11 1h8a1 1 0 0 1 0 2h-8a1 1 0 0 1 0-2ZM29 56h6a1 1 0 0 1 0 2h-6a1 1 0 0 1 0-2Z',
    tint: '#d9bcd6',
  },
};

interface Props {
  variant: HalloweenGhostVariant;
  className?: string;
}

/** A softly lit, translucent ghost with cloth folds and recessed eyes. */
const HalloweenGhost: FC<Props> = ({ variant, className }) => {
  const { body, face, tint } = GHOSTS[variant];
  const id = useId();

  return (
    <svg
      viewBox="0 0 64 88"
      className={mergeClasses('h-28 w-auto drop-shadow-md', className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}-cloth`} cx="32%" cy="18%" r="85%">
          <stop stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.4" stopColor={tint} stopOpacity="0.85" />
          <stop offset="0.75" stopColor={tint} stopOpacity="0.5" />
          <stop offset="1" stopColor={tint} stopOpacity="0.08" />
        </radialGradient>
        <linearGradient id={`${id}-fold`} x2="1" y2="0">
          <stop stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor={tint} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-face`}>
          <stop stopColor="#28283c" stopOpacity="0.95" />
          <stop offset="1" stopColor="#494359" stopOpacity="0.6" />
        </radialGradient>
        <clipPath id={`${id}-outline`}>
          <path d={body} />
        </clipPath>
      </defs>
      <path
        d={body}
        fill={`url(#${id}-cloth)`}
        stroke={tint}
        strokeOpacity="0.5"
        strokeWidth="0.65"
      />
      <g clipPath={`url(#${id}-outline)`}>
        <path
          d="M21 24Q13 48 20 84L28 84Q21 56 27 27ZM39 20Q46 48 37 84L47 86Q54 52 44 22Z"
          fill={`url(#${id}-fold)`}
        />
        <path
          d="M17 54Q13 68 18 83M31 57Q35 72 29 86M46 51Q41 67 48 81"
          fill="none"
          stroke={tint}
          strokeOpacity="0.5"
          strokeWidth="1"
        />
        <path
          d="M19 21Q24 9 35 12"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.6"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d={face} fill={`url(#${id}-face)`} />
      </g>
    </svg>
  );
};

export default memo(HalloweenGhost);
