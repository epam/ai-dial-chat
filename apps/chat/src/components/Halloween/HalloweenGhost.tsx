import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { memo } from 'react';
import { HalloweenGhostVariant } from '../../types/halloween';

/*
 * One entry per `HalloweenGhostVariant`: the silhouette, the face drawn on it,
 * and the pastel fill that tells it apart from its neighbours in the flock.
 *
 * `body` is a closed path in a 64x88 box — head arc, straight sides, and a
 * hem of humps whose count and width is what makes each silhouette read
 * differently at a glance. The fills come from Tailwind's `fill` scale, which
 * this repo extends with the same visual-background tokens as `bg-*`, so a
 * theme that retints those tokens retints the ghosts with it.
 */
const GHOSTS: Record<
  HalloweenGhostVariant,
  { body: string; face: string; fillClassName: string }
> = {
  [HalloweenGhostVariant.Classic]: {
    body: 'M32 4C17 4 9 16 9 31v53c0 3 3 4 5 2l6-7c1-2 4-2 5 0l5 6c1 2 4 2 5 0l5-6c1-2 4-2 5 0l6 7c2 2 5 1 5-2V31C56 16 47 4 32 4Z',
    face: 'M23 34a4 5 0 1 0 0 .1Zm18 0a4 5 0 1 0 0 .1ZM32 52a5 4 0 0 0 5-4h-10a5 4 0 0 0 5 4Z',
    fillClassName: 'fill-violet-1',
  },
  [HalloweenGhostVariant.Tall]: {
    body: 'M32 3C21 3 15 14 15 28v56c0 3 2 4 4 2l4-5c1-1 3-1 4 0l3 4c1 1 3 1 4 0l3-4c1-1 3-1 4 0l4 5c2 2 4 1 4-2V28C49 14 43 3 32 3Z',
    face: 'M22 33h8a1 1 0 0 1 0 2h-8a1 1 0 0 1 0-2Zm12 0h8a1 1 0 0 1 0 2h-8a1 1 0 0 1 0-2ZM28 50h8a1 1 0 0 1 0 2h-8a1 1 0 0 1 0-2Z',
    fillClassName: 'fill-blue',
  },
  [HalloweenGhostVariant.Blob]: {
    body: 'M32 8C14 8 5 21 5 38v42c0 4 4 5 7 2l9-9c2-2 5-2 7 0l8 9c2 2 5 2 7 0l9-9c3-3 7-2 7 2V38C59 21 50 8 32 8Z',
    face: 'M22 38a5 6 0 1 0 0 .1Zm20 0a5 6 0 1 0 0 .1ZM32 56a6 7 0 1 0 0 .1Z',
    fillClassName: 'fill-brown',
  },
  [HalloweenGhostVariant.Sprite]: {
    body: 'M32 14C21 14 15 23 15 34v42c0 3 3 4 5 2l7-8c2-2 5-2 7 0l7 8c2 2 5 1 5-2V34C46 23 43 14 32 14Z',
    face: 'M23 41a3 4 0 1 0 0 .1Zm11 1h8a1 1 0 0 1 0 2h-8a1 1 0 0 1 0-2ZM29 56h6a1 1 0 0 1 0 2h-6a1 1 0 0 1 0-2Z',
    fillClassName: 'fill-red',
  },
};

interface Props {
  variant: HalloweenGhostVariant;
  className?: string;
}

/**
 * A single decorative ghost, drawn inline so it inherits the theme's tokens
 * and needs no asset request. Marked `aria-hidden` by the layer that renders
 * it — see `HalloweenBurstOverlay`.
 */
const HalloweenGhost: FC<Props> = ({ variant, className }) => {
  const { body, face, fillClassName } = GHOSTS[variant];

  return (
    <svg
      viewBox="0 0 64 88"
      className={mergeClasses('h-24 w-auto drop-shadow-md', className)}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={body}
        className={mergeClasses(fillClassName, 'stroke-default')}
        strokeWidth="1.5"
      />
      <path d={face} className="fill-control-inverted" />
    </svg>
  );
};

export default memo(HalloweenGhost);
