import { memo, useId, type FC } from 'react';
import styles from './Halloween.module.scss';

/** Layered, candlelit jack-o'-lantern. Its face reacts with its parent button. */
const HalloweenPumpkin: FC = () => {
  const id = useId();

  return (
    <svg
      viewBox="0 0 160 160"
      className={styles.pumpkin}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}-skin`} cx="35%" cy="28%" r="78%">
          <stop stopColor="#ffbd60" />
          <stop offset="0.38" stopColor="#ed791d" />
          <stop offset="0.76" stopColor="#b83d0b" />
          <stop offset="1" stopColor="#59220e" />
        </radialGradient>
        <radialGradient id={`${id}-rib`} cx="40%" cy="24%" r="85%">
          <stop stopColor="#ffbc59" />
          <stop offset="0.5" stopColor="#ee7d20" />
          <stop offset="1" stopColor="#89310c" />
        </radialGradient>
        <linearGradient id={`${id}-stem`} x2="1" y2="1">
          <stop stopColor="#a2a45c" />
          <stop offset="0.5" stopColor="#626035" />
          <stop offset="1" stopColor="#302e22" />
        </linearGradient>
        <radialGradient id={`${id}-candle`} cy="70%">
          <stop stopColor="#fff9c5" />
          <stop offset="0.6" stopColor="#ffd35d" />
          <stop offset="1" stopColor="#e88616" />
        </radialGradient>
      </defs>
      <ellipse cx="81" cy="142" rx="55" ry="7" fill="#100c16" opacity="0.18" />
      <g className={styles.pumpkinBody}>
        <path
          d="M71 44C77 33 70 24 79 13L92 17C82 28 89 35 84 46Z"
          fill={`url(#${id}-stem)`}
          stroke="#45452b"
          strokeWidth="1.5"
        />
        <path
          d="M80 38C82 26 79 23 85 18"
          fill="none"
          stroke="#d4bf80"
          strokeOpacity="0.5"
          strokeWidth="2"
        />
        <path
          d="M80 45C56 24 19 41 15 78C10 112 30 141 59 140L80 137L103 140C136 140 151 114 146 78C142 43 110 25 80 45Z"
          fill={`url(#${id}-skin)`}
          stroke="#773114"
          strokeWidth="1.5"
        />
        <ellipse
          cx="57"
          cy="88"
          rx="30"
          ry="51"
          fill={`url(#${id}-rib)`}
          stroke="#a34a15"
          strokeOpacity="0.5"
        />
        <ellipse
          cx="104"
          cy="88"
          rx="29"
          ry="51"
          fill={`url(#${id}-rib)`}
          stroke="#a34a15"
          strokeOpacity="0.5"
        />
        <ellipse
          cx="80"
          cy="89"
          rx="26"
          ry="51"
          fill={`url(#${id}-rib)`}
          stroke="#a34a15"
          strokeOpacity="0.55"
        />
        <path
          d="M40 55C30 66 29 78 30 85M66 47C59 56 58 63 57 71M98 49C108 62 110 69 110 76"
          fill="none"
          stroke="#ffdd97"
          strokeOpacity="0.4"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <g
          fill="#532211"
          stroke="#843614"
          strokeWidth="2"
          strokeLinejoin="round"
        >
          <path d="M35 73L66 84Q58 61 35 73ZM125 73L94 84Q102 61 125 73Z" />
          <path d="M80 85L72 100L87 100Z" />
          <path d="M35 101Q80 130 125 101L116 119L105 118L100 127L88 129L84 120L74 120L70 130L56 126L51 117L43 116Z" />
        </g>
        <g className={styles.pumpkinLight} fill={`url(#${id}-candle)`}>
          <g className={styles.pumpkinEyes}>
            <path d="M39 73L62 81Q55 65 39 73ZM121 73L98 81Q105 65 121 73Z" />
          </g>
          <path d="M80 89L76 97L83 97Z" />
          <path d="M40 106Q80 131 120 106L113 116L103 114L98 124L90 125L86 116L72 116L68 126L59 123L54 113L45 113Z" />
        </g>
        <path
          d="M82 43C95 34 100 43 111 38"
          fill="none"
          stroke="#797243"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
};

export default memo(HalloweenPumpkin);
