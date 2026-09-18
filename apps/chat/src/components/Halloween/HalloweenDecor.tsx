import { GhostIconButton } from '@epam/ai-dial-ui-kit';
import type { CSSProperties, FC } from 'react';
import { memo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HALLOWEEN_DECOR_BAT_COUNT,
  HALLOWEEN_PUMPKIN_CLICKS,
} from '../../constants/halloween';
import { HalloweenI18nKeys } from '../../constants/translation-keys';
import { useHalloween } from '../../context/HalloweenContext';
import { HalloweenBurst } from '../../types/halloween';
import styles from './Halloween.module.scss';

/* A corner cobweb: quarter-circle threads with radial spokes, drawn from the
   origin so the same path serves both corners once one is mirrored. */
const Cobweb: FC = () => (
  <svg
    viewBox="0 0 64 64"
    className="size-16 stroke-tertiary desktop:size-24"
    fill="none"
    strokeWidth="1"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M0 0 L64 64 M0 0 L64 24 M0 0 L24 64 M0 0 L64 48 M0 0 L48 64" />
    <path d="M14 0 A14 14 0 0 1 0 14 M28 0 A28 28 0 0 1 0 28 M44 0 A44 44 0 0 1 0 44 M62 0 A62 62 0 0 1 0 62" />
  </svg>
);

/**
 * Seasonal chrome for the empty-chat screen while the `halloweenEnabled`
 * feature flag is on: cobwebs in the top corners, drifting bats, and a pumpkin
 * that answers `HALLOWEEN_PUMPKIN_CLICKS` clicks with a ghost fly-by.
 *
 * Renders nothing when the feature is off, so the call site needs no gate of
 * its own. The cobwebs and bats sit in an `aria-hidden`, pointer-transparent
 * layer; the pumpkin is a real labelled button, kept outside that layer so it
 * stays reachable by keyboard.
 */
const HalloweenDecor: FC = () => {
  const { t } = useTranslation();
  const { isEnabled, celebrate } = useHalloween();
  const clicksRef = useRef(0);

  const handlePumpkinClick = useCallback(() => {
    clicksRef.current += 1;
    if (clicksRef.current < HALLOWEEN_PUMPKIN_CLICKS) return;
    clicksRef.current = 0;
    celebrate(HalloweenBurst.Ghost);
  }, [celebrate]);

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none overflow-hidden"
      >
        <div className="absolute start-0 top-0 opacity-40">
          <Cobweb />
        </div>
        <div className="absolute end-0 top-0 scale-x-[-1] opacity-40">
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
