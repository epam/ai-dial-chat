import { memo, useId, useMemo, type FC } from 'react';
import { buildHalloweenWisps } from '../../utils/halloween';
import styles from './Halloween.module.scss';

/** A little familiar crosses the bottom edge while dim lights drift upward. */
const HalloweenCatScene: FC = () => {
  const id = useId();
  const wisps = useMemo(() => buildHalloweenWisps(), []);
  return (
    <>
      {wisps.map((style, index) => (
        <span key={index} style={style} className={styles.wisp} />
      ))}
      <span className={styles.catTraveler}>
        <svg
          viewBox="0 0 100 90"
          className={styles.catBody}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={`${id}-fur`} x2="0.8" y2="1">
              <stop stopColor="#73677b" />
              <stop offset="0.5" stopColor="#302b3a" />
              <stop offset="1" stopColor="#171621" />
            </linearGradient>
          </defs>
          <path
            className={styles.catTail}
            d="M31 63C6 65 5 41 17 37C29 32 28 19 20 16"
            fill="none"
            stroke="#65596f"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M26 73Q19 59 29 46Q40 34 58 48L70 68L71 80L62 81L56 65L42 69L38 81L26 81Z"
            fill={`url(#${id}-fur)`}
            stroke="#a799b0"
            strokeWidth="0.6"
          />
          <path
            d="M48 38L45 17L58 26L69 25L82 16L80 38Q85 55 66 57Q47 55 48 38Z"
            fill={`url(#${id}-fur)`}
            stroke="#b9a5be"
            strokeWidth="0.7"
          />
          <path d="M50 24L56 29L50 33ZM77 24L71 29L77 32Z" fill="#b08191" />
          <g className={styles.catEyes}>
            <path
              d="M53 38Q59 32 63 39Q57 45 53 38ZM68 39Q73 32 78 37Q76 44 68 39Z"
              fill="#cbd98d"
            />
            <path d="M59 36V41M73 36V41" stroke="#171621" strokeWidth="1.3" />
          </g>
          <path d="M64 44L68 44L66 47Z" fill="#c68f98" />
          <path
            d="M66 47L63 49M66 47L69 49M56 46L43 43M55 49L42 50M76 45L88 41M77 48L90 48"
            fill="none"
            stroke="#b9a5be"
            strokeWidth="0.6"
          />
        </svg>
      </span>
    </>
  );
};

export default memo(HalloweenCatScene);
