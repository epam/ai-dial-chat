import { useId, type FC } from 'react';
import { CandyJanitorKind } from '../../utils/halloween-candy-plan';
import styles from './HalloweenCandy.module.scss';

/** Folded wrappers, rounded hard candy and striped candy corn share a small silhouette. */
export const CandySweet: FC<{ variant: number }> = ({ variant }) => (
  <svg
    viewBox="0 0 64 48"
    className="size-full overflow-visible"
    aria-hidden="true"
    focusable="false"
  >
    {variant % 3 === 1 ? (
      <>
        <path
          className={styles.corn}
          d="M26 4Q32-3 38 4L60 38Q66 48 53 48H11Q-2 48 4 38Z"
        />
        <path className={styles.orange} d="M15 21H49L59 37H5Z" />
        <path className={styles.cream} d="M26 4Q32-3 38 4L44 13H20Z" />
        <path className={styles.glint} d="M13 34L22 19" />
      </>
    ) : (
      <>
        <path
          className={variant % 3 ? styles.purple : styles.green}
          d="M20 14L2 3L6 23L0 43L20 34ZM44 14L62 3L58 23L64 43L44 34Z"
        />
        <path
          className={styles.wrapperFold}
          d="M4 10L18 21L4 36M60 10L46 21L60 36"
        />
        <rect
          className={variant % 3 ? styles.purple : styles.green}
          x="15"
          y="1"
          width="34"
          height="46"
          rx="12"
        />
        <path
          className={styles.wrapperFold}
          d="M19 36Q34 44 46 32V38Q43 48 33 47H27Q18 46 19 36Z"
        />
        <path className={styles.stripe} d="M21 9L42 36M30 5L45 24" />
        <path className={styles.glint} d="M20 18Q19 8 26 6" />
      </>
    )}
  </svg>
);

/** Neck pivot (48,30), beak tip (95,30), feet at y=90 match the contact plan. */
export const CandyRaven: FC = () => {
  const id = useId();
  return (
    <svg
      viewBox="0 0 100 100"
      className="size-full overflow-visible"
      aria-hidden="true"
      focusable="false"
      data-candy-raven-art
    >
      <defs>
        <linearGradient id={id} x2=".8" y2="1">
          <stop className={styles.featherLight} />
          <stop offset=".45" className={styles.featherMid} />
          <stop offset="1" className={styles.featherDark} />
        </linearGradient>
      </defs>
      <path
        className={styles.feather}
        d="M35 53L3 78L8 83L21 80L16 88L44 75Z"
      />
      <path
        className={styles.claw}
        d="M46 73L44 87L33 90M44 87L52 90M63 72L67 87L59 90M67 87L77 90"
      />
      <path
        d="M35 34Q19 48 29 69Q40 84 61 75Q78 67 69 41Z"
        fill={`url(#${id})`}
        className={styles.outline}
      />
      <path
        className={styles.featherLine}
        d="M31 57L46 70M30 65L39 73M48 72L58 68"
      />
      <g
        data-candy-wing
        style={{ transformOrigin: '38px 45px', transform: 'rotate(-76deg)' }}
      >
        <path
          d="M40 47Q24 17 2 9L-5 12L4 27L-4 24L2 38L-3 37L8 54L6 58L22 69L38 62Z"
          fill={`url(#${id})`}
          className={styles.outline}
        />
        <path
          className={styles.featherLine}
          d="M4 19L30 53M5 34L29 58M11 49L28 63"
        />
      </g>
      <g data-candy-head style={{ transformOrigin: '48px 30px' }}>
        <path
          d="M41 41Q30 30 38 15Q44 4 60 9Q76 14 73 30L67 42L52 48L52 39L46 44Z"
          fill={`url(#${id})`}
          className={styles.outline}
        />
        <path className={styles.beak} d="M68 20Q86 23 95 30L69 33L65 27Z" />
        <path className={styles.beakLine} d="M71 28L95 30" />
        <ellipse className={styles.eye} cx="61" cy="20" rx="3.7" ry="3" />
        <circle className={styles.ink} cx="63" cy="20" r="1.8" />
        <circle className={styles.cream} cx="61" cy="18.5" r=".8" />
        <path className={styles.featherLine} d="M40 18Q49 8 58 13" />
        <circle data-candy-beak-tip cx="95" cy="30" r=".1" opacity="0" />
      </g>
    </svg>
  );
};

/** A shared broom/hand group keeps the grip intact through sweeping and brandishing. */
export const CandyJanitor: FC<{ kind: CandyJanitorKind }> = ({ kind }) => {
  const mummy = kind === CandyJanitorKind.Mummy;
  return (
    <svg
      viewBox="0 0 160 180"
      className="size-full overflow-visible"
      aria-hidden="true"
      focusable="false"
      data-candy-janitor-art={kind}
    >
      <g data-candy-leg="0" style={{ transformOrigin: '85px 119px' }}>
        <path
          className={mummy ? styles.linen : styles.bone}
          d="M76 114L94 117L89 146L75 170L82 176H57Q52 171 62 165L70 143Z"
        />
        <path
          className={styles.seam}
          d="M72 133L89 138M65 151L81 158M60 168L74 171"
        />
      </g>
      <g data-candy-leg="1" style={{ transformOrigin: '111px 119px' }}>
        <path
          className={mummy ? styles.linen : styles.bone}
          d="M102 114L118 114L126 142L120 169L135 173L134 177H106Q99 174 105 167L109 143Z"
        />
        <path
          className={styles.seam}
          d="M107 131L122 130M108 149L123 152M104 165L121 169"
        />
      </g>
      <path
        className={mummy ? styles.linen : styles.bone}
        d="M78 64Q97 54 119 69L126 119Q100 133 72 119L69 87Z"
      />
      {mummy ? (
        <path
          className={styles.seam}
          d="M77 69L121 88M72 83L124 102M72 100L121 116M75 119L123 88M71 98L117 69"
        />
      ) : (
        <path
          className={styles.inkLine}
          d="M96 67L98 111M80 78Q98 88 118 77M78 90Q98 100 120 88M80 104Q99 114 117 103"
        />
      )}
      <path
        className={styles.apron}
        d="M80 79L77 119Q96 129 121 119L115 79L109 71L106 84H90L88 70Z"
      />
      <path className={styles.apronLight} d="M91 99L108 99L106 112H91Z" />
      <g>
        <path
          className={mummy ? styles.linen : styles.bone}
          d="M92 19Q119 13 124 34L122 53L116 66L89 64L81 54L73 49L80 41L79 31Q80 22 92 19Z"
        />
        {mummy ? (
          <>
            <path
              className={styles.seam}
              d="M82 28L122 40M80 42L120 55M87 59L116 63M84 52L119 25"
            />
            <path className={styles.ink} d="M79 35L117 36L115 46L79 44Z" />
            <ellipse className={styles.eye} cx="86" cy="40" rx="4" ry="2.8" />
            <ellipse className={styles.eye} cx="105" cy="40" rx="4" ry="2.8" />
            <path className={styles.inkLine} d="M91 54L105 57" />
          </>
        ) : (
          <>
            <path
              className={styles.ink}
              d="M82 32Q95 28 94 40Q87 45 81 38ZM101 32Q115 29 115 41Q105 45 101 38ZM95 43L90 49H99Z"
            />
            <path
              className={styles.seam}
              d="M87 55H113M91 52V61M98 53V63M106 53V62"
            />
            <circle className={styles.eye} cx="86" cy="35" r="1.7" />
            <circle className={styles.eye} cx="106" cy="35" r="1.7" />
          </>
        )}
        <path
          className={styles.apron}
          d="M78 25Q81 10 105 12Q122 13 126 27L80 30L68 27Z"
        />
        <path className={styles.apronLight} d="M87 17Q103 11 119 22L86 24Z" />
      </g>
      <g data-candy-arms style={{ transformOrigin: '92px 74px' }}>
        <path className={styles.handle} d="M96 60L19 160" />
        <path className={styles.bristles} d="M16 149L33 157L35 174L0 174Z" />
        <path
          className={styles.bristleLines}
          d="M17 154L7 171M22 157L17 173M27 159L26 173"
        />
        <path className={styles.binding} d="M16 149L33 157L30 163L13 155Z" />
        <path
          className={mummy ? styles.linen : styles.bone}
          d="M81 73L94 80L73 100L65 94L68 84Z"
        />
        <path
          className={mummy ? styles.linen : styles.bone}
          d="M112 77L122 85L97 112L64 119L59 111L85 101Z"
        />
        <path
          className={styles.seam}
          d="M79 81L88 87M72 89L80 95M108 86L114 94M97 96L104 102M70 108L73 118"
        />
        <circle data-candy-brush-tip cx="18" cy="174" r=".1" opacity="0" />
      </g>
    </svg>
  );
};
