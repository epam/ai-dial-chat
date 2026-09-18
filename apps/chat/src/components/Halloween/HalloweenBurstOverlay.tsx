import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { CSSProperties, FC } from 'react';
import { memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  HALLOWEEN_TREAT_COUNT,
  HALLOWEEN_TREAT_GLYPHS,
} from '../../constants/halloween';
import { HalloweenBurst } from '../../types/halloween';
import styles from './Halloween.module.scss';

interface Treat {
  glyph: string;
  style: CSSProperties;
}

/*
 * Randomized once per burst rather than per render: the layer re-renders on
 * every ancestor state change, and re-rolling the offsets would restart each
 * glyph's animation mid-fall.
 */
const buildTreats = (): Treat[] =>
  Array.from({ length: HALLOWEEN_TREAT_COUNT }, (_, index) => ({
    glyph: HALLOWEEN_TREAT_GLYPHS[index % HALLOWEEN_TREAT_GLYPHS.length],
    style: {
      '--halloween-x': `${Math.round(Math.random() * 96)}%`,
      '--halloween-delay': `${(Math.random() * 1.4).toFixed(2)}s`,
      '--halloween-duration': `${(2.8 + Math.random() * 1.6).toFixed(2)}s`,
      '--halloween-drift': `${Math.round(Math.random() * 120 - 60)}px`,
      fontSize: `${(1.25 + Math.random()).toFixed(2)}rem`,
    } as CSSProperties,
  }));

interface Props {
  /** Which celebration to play. */
  burst: HalloweenBurst;
}

/**
 * The full-viewport celebration layer of the Halloween easter egg, portaled to
 * `document.body` so no scroll container clips it.
 *
 * Purely decorative: the layer is `aria-hidden` and never takes pointer
 * events, and the announcement a screen-reader user gets is the notification
 * `HalloweenProvider` raises alongside it.
 */
const HalloweenBurstOverlay: FC<Props> = ({ burst }) => {
  const treats = useMemo(
    () => (burst === HalloweenBurst.Treats ? buildTreats() : []),
    [burst],
  );

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70] select-none overflow-hidden"
    >
      {burst === HalloweenBurst.Ghost ? (
        <span className={mergeClasses(styles.ghost, 'text-6xl')}>👻</span>
      ) : (
        treats.map((treat, index) => (
          <span
            /* Index is the identity here: the list is built once per burst and
               never reordered, and glyphs repeat. */
            key={index}
            className={styles.treat}
            style={treat.style}
          >
            {treat.glyph}
          </span>
        ))
      )}
    </div>,
    document.body,
  );
};

export default memo(HalloweenBurstOverlay);
