import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { ButtonAppearance, IconButton } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { HalloweenI18nKeys } from '../../constants/translation-keys';
import type { CelebrationDecorationProps } from '../../types/celebration';
import styles from './Halloween.module.scss';
import HalloweenCornerSpider from './HalloweenCornerSpider';
import HalloweenPumpkin from './HalloweenPumpkin';

interface CobwebProps {
  /** Mirroring classes, so the web's dense end lands in the screen corner. */
  className?: string;
}

/*
 * A corner cobweb: radial spokes with the quarter-circle threads strung
 * between them, drawn from its own top-left so the same paths serve both
 * corners once one is mirrored. The spokes are drawn heavier than the
 * threads, the way a real web reads. Kept faint on purpose — it frames the
 * screen, it does not compete with it.
 */
const Cobweb: FC<CobwebProps> = ({ className }) => (
  <svg
    viewBox="0 0 64 64"
    className={mergeClasses(
      'size-32 stroke-tertiary opacity-40 desktop:size-52',
      className,
    )}
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

/** Halloween artwork; eligibility and scene selection belong to the shared runtime. */
const HalloweenDecor: FC<CelebrationDecorationProps> = ({ onActivate }) => {
  const { t } = useTranslation();

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none overflow-hidden"
      >
        {/* The mirror belongs on the web, never on the corner: a flipped
            ancestor would also flip the spider's inline transform, so it
            would flee towards the pointer instead of away from it and jam
            against its leash. The spider is placed with logical insets
            instead, which follow the corner the same way the mirror does.
            The faintness lives on the web too — the spiders are the part
            worth seeing. */}
        <div className="absolute start-0 top-0">
          <Cobweb className="rtl:scale-x-[-1]" />
          <HalloweenCornerSpider className="start-[42%] top-[30%]" />
        </div>
        <div className="absolute end-0 top-0">
          <Cobweb className="scale-x-[-1] rtl:scale-x-100" />
          <HalloweenCornerSpider className="end-[26%] top-[48%]" />
        </div>
      </div>
      <div
        data-halloween-pumpkin-anchor="true"
        className="absolute bottom-2 end-2 desktop:bottom-4 desktop:end-4"
      >
        <IconButton
          appearance={ButtonAppearance.Link}
          className={styles.pumpkinButton}
          icon={<HalloweenPumpkin />}
          aria-label={t(HalloweenI18nKeys.PumpkinLabel)}
          onClick={onActivate}
        />
      </div>
    </>
  );
};

export default memo(HalloweenDecor);
