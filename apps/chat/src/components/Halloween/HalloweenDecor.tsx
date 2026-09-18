import { GhostIconButton } from '@epam/ai-dial-ui-kit';
import type { CSSProperties, FC } from 'react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HALLOWEEN_DECOR_BAT_COUNT } from '../../constants/halloween';
import { HalloweenI18nKeys } from '../../constants/translation-keys';
import { useHalloween } from '../../context/HalloweenContext';
import { HalloweenBurst } from '../../types/halloween';
import styles from './Halloween.module.scss';

/*
 * A corner cobweb: radial spokes with the quarter-circle threads strung
 * between them, drawn from the origin so the same paths serve both corners
 * once one is mirrored. The spokes are drawn heavier than the threads, the way
 * a real web reads, and a dangling spider hangs off the outermost thread.
 */
const Cobweb: FC = () => (
  <svg
    viewBox="0 0 64 64"
    className="size-32 stroke-secondary desktop:size-52"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M0 0 L64 64 M0 0 L64 18 M0 0 L18 64 M0 0 L64 40 M0 0 L40 64 M0 0 L64 4 M0 0 L4 64"
      strokeWidth="1.1"
    />
    <path
      d="M12 0 A12 12 0 0 1 0 12 M24 0 A24 24 0 0 1 0 24 M36 0 A36 36 0 0 1 0 36 M48 0 A48 48 0 0 1 0 48 M62 0 A62 62 0 0 1 0 62"
      strokeWidth="0.8"
    />
    {/* Spider: a thread down from the web, then body, head and legs. */}
    <path d="M44 31 V41" strokeWidth="0.8" />
    <ellipse cx="44" cy="45" rx="3" ry="3.6" className="fill-secondary" />
    <circle cx="44" cy="41.6" r="1.5" className="fill-secondary" />
    <path
      d="M41 43 L37 40 M41 45 L36.5 45 M41 47 L37 50 M47 43 L51 40 M47 45 L51.5 45 M47 47 L51 50"
      strokeWidth="0.8"
    />
  </svg>
);

/**
 * Seasonal chrome for the empty-chat screen while the `halloweenEnabled`
 * feature flag is on: cobwebs in the top corners, drifting bats, and a pumpkin
 * that releases a flock of ghosts across the viewport when clicked.
 *
 * Renders nothing when the feature is off, so the call site needs no gate of
 * its own. The cobwebs and bats sit in an `aria-hidden`, pointer-transparent
 * layer; the pumpkin is a real labelled button, kept outside that layer so it
 * stays reachable by keyboard.
 */
const HalloweenDecor: FC = () => {
  const { t } = useTranslation();
  const { isEnabled, celebrate } = useHalloween();

  const handlePumpkinClick = useCallback(
    () => celebrate(HalloweenBurst.Ghost),
    [celebrate],
  );

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none overflow-hidden"
      >
        <div className="absolute start-0 top-0 opacity-80">
          <Cobweb />
        </div>
        <div className="absolute end-0 top-0 scale-x-[-1] opacity-80">
          <Cobweb />
        </div>
        <div className="absolute inset-x-0 top-1/4 flex justify-center gap-16 text-2xl opacity-70">
          {Array.from({ length: HALLOWEEN_DECOR_BAT_COUNT }, (_, index) => (
            <span
              key={index}
              className={styles.bat}
              style={
                {
                  '--halloween-delay': `${index * 0.9}s`,
                  '--halloween-duration': `${6 + index}s`,
                } as CSSProperties
              }
            >
              🦇
            </span>
          ))}
        </div>
      </div>
      <div className="absolute bottom-4 end-4">
        <GhostIconButton
          icon={
            <span aria-hidden="true" className={styles.pumpkin}>
              🎃
            </span>
          }
          aria-label={t(HalloweenI18nKeys.PumpkinLabel)}
          onClick={handlePumpkinClick}
        />
      </div>
    </>
  );
};

export default memo(HalloweenDecor);
