import { useId, type FC } from 'react';
import { SkeletonPart } from '../../utils/halloween-skeleton-plan';
import styles from './HalloweenSkeletons.module.scss';

/* Pivots match SKELETON_ART: shoulders (36|64, 58), hips (42|58, 116), neck (50, 46). */
const part = (name: SkeletonPart, x: number, y: number) => ({
  'data-skeleton-part': name,
  style: { transformOrigin: `${x}px ${y}px` },
});

/** A dark edge under a lighter bone keeps thin limbs legible on light and dark hosts. */
const Limb: FC<{ d: string }> = ({ d }) => (
  <>
    <path className={styles.limbEdge} d={d} />
    <path className={styles.limb} d={d} />
  </>
);

/** Cranium, suture and a hideable face so the back of the skull can show. */
const SkullShapes: FC<{ gradient: string }> = ({ gradient }) => (
  <>
    <path
      className={styles.bone}
      fill={`url(#${gradient})`}
      d="M29 27Q27 5 50 4Q73 5 71 27Q71 34 65 37V44Q50 48 35 44V37Q29 34 29 27Z"
    />
    <path className={styles.suture} d="M50 5Q46 11 52 15Q48 18 51 22" />
    <g data-skeleton-part={SkeletonPart.Face}>
      <path
        className={styles.socket}
        d="M32 24Q33 16 40 16Q47 17 46 25Q45 32 39 32Q32 31 32 24ZM54 25Q53 17 60 16Q67 16 68 24Q68 31 61 32Q55 32 54 25Z"
      />
      <path className={styles.glint} d="M40 23h.1M60 23h.1" />
      <path className={styles.socket} d="M50 30L46.5 36H53.5Z" />
      <path
        className={styles.teeth}
        d="M37 40Q50 44 63 40M41 40.5V45M46 41.5V46M50 42V46.5M54 41.5V46M59 40.5V45"
      />
    </g>
  </>
);

/** Filled bones with a darker edge; lit from the top left. */
export const SkeletonArt: FC<{ partner?: boolean; headless?: boolean }> = ({
  partner,
  headless,
}) => {
  const id = useId();
  return (
    <svg
      viewBox="0 0 100 170"
      className="size-full overflow-visible"
      aria-hidden="true"
      focusable="false"
      data-skeleton-art={partner ? 'partner' : 'showman'}
    >
      <defs>
        <linearGradient id={id} x2=".7" y2="1">
          <stop className={styles.boneLight} />
          <stop offset=".6" className={styles.boneMid} />
          <stop offset="1" className={styles.boneDark} />
        </linearGradient>
      </defs>
      <g {...part(SkeletonPart.LegLeft, 42, 116)}>
        <Limb d="M42 116L37 137L33 156L21 158" />
        <circle className={styles.joint} cx="37" cy="137" r="3.4" />
      </g>
      <g {...part(SkeletonPart.LegRight, 58, 116)}>
        <Limb d="M58 116L63 137L67 156L79 158" />
        <circle className={styles.joint} cx="63" cy="137" r="3.4" />
      </g>
      <g {...part(SkeletonPart.Body, 50, 158)}>
        <Limb d="M50 46V110" />
        <path
          className={styles.bone}
          fill={`url(#${id})`}
          d="M50 51Q34 52 33 66Q32 80 38 87Q44 92 50 89Q56 92 62 87Q68 80 67 66Q66 52 50 51Z"
        />
        <path
          className={styles.ribs}
          d="M37 62Q43 59 48 63M63 62Q57 59 52 63M36 71Q43 68 48 72M64 71Q57 68 52 72M38 80Q43 77 48 81M62 80Q57 77 52 81"
        />
        <path
          className={styles.bone}
          fill={`url(#${id})`}
          d="M36 104Q50 98 64 104L61 118Q50 112 39 118Z"
        />
        <Limb d="M34 56Q50 50 66 56" />
        {partner && (
          <path className={styles.bow} d="M50 49L41 44V54ZM50 49L59 44V54Z" />
        )}
        <g {...part(SkeletonPart.ArmLeft, 36, 58)}>
          <Limb d="M36 58L27 78L22 96M22 96L18 102M22 96L22 103M22 96L26 101" />
          <circle className={styles.joint} cx="27" cy="78" r="3" />
        </g>
        <g {...part(SkeletonPart.ArmRight, 64, 58)}>
          <Limb d="M64 58L73 78L78 96M78 96L82 102M78 96L78 103M78 96L74 101" />
          <circle className={styles.joint} cx="73" cy="78" r="3" />
        </g>
        <g
          {...part(SkeletonPart.Skull, 50, 46)}
          opacity={headless ? 0 : undefined}
        >
          <SkullShapes gradient={id} />
        </g>
      </g>
    </svg>
  );
};

/** The detached skull, drawn in a square box centred on the cranium. */
export const SkeletonSkullArt: FC = () => {
  const id = useId();
  return (
    <svg
      viewBox="28 3 44 44"
      className="size-full overflow-visible"
      aria-hidden="true"
      focusable="false"
      data-skeleton-free-skull-art
    >
      <defs>
        <linearGradient id={id} x2=".7" y2="1">
          <stop className={styles.boneLight} />
          <stop offset=".6" className={styles.boneMid} />
          <stop offset="1" className={styles.boneDark} />
        </linearGradient>
      </defs>
      <SkullShapes gradient={id} />
    </svg>
  );
};
