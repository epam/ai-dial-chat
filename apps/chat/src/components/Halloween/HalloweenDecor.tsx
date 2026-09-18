import { GhostIconButton } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HalloweenI18nKeys } from '../../constants/translation-keys';
import { useHalloween } from '../../context/HalloweenContext';
import { HalloweenBurst } from '../../types/halloween';
import styles from './Halloween.module.scss';
import HalloweenCornerSpider from './HalloweenCornerSpider';

/*
 * A corner cobweb: radial spokes with the quarter-circle threads strung
 * between them, drawn from the origin so the same paths serve both corners
 * once one is mirrored. The spokes are drawn heavier than the threads, the
 * way a real web reads. Kept faint on purpose — it frames the screen, it does
 * not compete with it.
 */
const Cobweb: FC = () => (
  <svg
    viewBox="0 0 64 64"
    className="size-32 stroke-tertiary opacity-40 desktop:size-52"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M0 0 L64 64 M0 0 L64 18 M0 0 L18 64 M0 0 L64 40 M0 0 L40 64 M0 0 L64 4 M0 0 L4 64"
      strokeWidth="0.7"
    />
    <path
      d="M12 0 A12 12 0 0 1 0 12 M24 0 A24 24 0 0 1 0 24 M36 0 A36 36 0 0 1 0 36 M48 0 A48 48 0 0 1 0 48 M62 0 A62 62 0 0 1 0 62"
      strokeWidth="0.5"
    />
  </svg>
);

/**
 * Seasonal chrome for the empty-chat screen while the `halloweenEnabled`
 * feature flag is on: a faint cobweb in each top corner with a spider perched
 * on it that scurries off when the pointer reaches it, and a pumpkin that
 * releases a flock of ghosts across the viewport when clicked.
 *
 * Renders nothing when the feature is off, so the call site needs no gate of
 * its own. The webs and their spiders sit in an `aria-hidden`,
 * pointer-transparent layer — only the spiders themselves take pointer events
 * back, so the rest of the corner stays click-through. The pumpkin is a real
 * labelled button, kept outside that layer so it stays reachable by keyboard.
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
        {/* The web is drawn from its own top-left, so whichever corner it
            lands in decides whether it is mirrored — hence the `rtl:`
            counterparts. The mirror takes the spider with it, so each one
            flees outward along its own web without a second set of offsets.
            The faintness lives on the web itself: the spiders are the part
            worth seeing. */}
        <div className="absolute start-0 top-0 rtl:scale-x-[-1]">
          <Cobweb />
          <HalloweenCornerSpider className="left-[42%] top-[30%]" />
        </div>
        <div className="absolute end-0 top-0 scale-x-[-1] rtl:scale-x-100">
          <Cobweb />
          <HalloweenCornerSpider className="left-[26%] top-[48%]" />
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
