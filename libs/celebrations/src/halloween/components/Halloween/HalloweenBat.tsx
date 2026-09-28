import { memo, useId, type FC } from 'react';
import { BatPart } from '../../utils/halloween-bat-plan';

interface Props {
  sleeper: boolean;
}

/** Articulated membrane wings, a wing blanket and expressive sleepy faces. */
const HalloweenBat: FC<Props> = ({ sleeper }) => {
  const id = useId();
  return (
    <svg viewBox="0 0 100 80" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient
          id={`${id}-membrane`}
          gradientUnits="userSpaceOnUse"
          x1="50"
          y1="8"
          x2="50"
          y2="62"
        >
          <stop stopColor="#a5808b" />
          <stop offset="0.32" stopColor="#745562" />
          <stop offset="0.7" stopColor="#473441" />
          <stop offset="1" stopColor="#241e2b" />
        </linearGradient>
        <radialGradient id={`${id}-fur`} cx="0.38" cy="0.28" r="0.78">
          <stop stopColor="#877482" />
          <stop offset="0.45" stopColor="#4d3e51" />
          <stop offset="1" stopColor="#211e2d" />
        </radialGradient>
        <linearGradient id={`${id}-blanket`} x2="1" y2="0.7">
          <stop stopColor="#9c7284" />
          <stop offset="0.35" stopColor="#5d4058" />
          <stop offset="1" stopColor="#292336" />
        </linearGradient>
        <radialGradient id={`${id}-eye`}>
          <stop stopColor="#fff1c3" />
          <stop offset="0.6" stopColor="#f7c66d" />
          <stop offset="1" stopColor="#d9823c" />
        </radialGradient>
      </defs>

      <g data-bat-part={BatPart.WingLeft}>
        <path
          d="M43 37Q33 25 27 29Q22 32 22 40L30 56Q37 51 44 48Z"
          fill={`url(#${id}-membrane)`}
        />
        <path
          d="M43 37Q34 31 27 29M44 48Q38 49 32 56"
          fill="none"
          stroke="#b994a1"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <g data-bat-part={BatPart.ForearmLeft}>
          <path
            d="M27 29Q18 12 5 9Q9 22 2 39Q14 31 17 50Q26 43 32 56L39 43Q35 33 27 29Z"
            fill={`url(#${id}-membrane)`}
          />
          <path
            d="M27 29Q18 12 5 9Q9 22 2 39Q14 31 17 50Q26 43 32 56"
            fill="none"
            stroke="#b994a1"
            strokeWidth="0.85"
            strokeLinejoin="round"
          />
          <path
            d="M27 29Q20 17 5 9M27 29Q15 29 2 39M27 29Q20 38 17 50M27 29Q30 42 32 56"
            fill="none"
            stroke="#b18a99"
            strokeWidth="0.85"
            strokeLinecap="round"
          />
          <path
            d="M25 28Q23 23 26 21Q29 20 28 25"
            fill="none"
            stroke="#dac1b2"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          <path
            d="M16 22Q19 26 22 28M11 34Q17 31 23 32M21 40L25 34M29 43L28 35"
            fill="none"
            stroke="#d2a7b1"
            strokeOpacity="0.28"
            strokeWidth="0.45"
          />
        </g>
      </g>
      <g data-bat-part={BatPart.WingRight}>
        <path
          d="M57 37Q67 25 73 29Q78 32 78 40L70 56Q63 51 56 48Z"
          fill={`url(#${id}-membrane)`}
        />
        <path
          d="M57 37Q66 31 73 29M56 48Q62 49 68 56"
          fill="none"
          stroke="#b994a1"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <g data-bat-part={BatPart.ForearmRight}>
          <path
            d="M73 29Q82 12 95 9Q91 22 98 39Q86 31 83 50Q74 43 68 56L61 43Q65 33 73 29Z"
            fill={`url(#${id}-membrane)`}
          />
          <path
            d="M73 29Q82 12 95 9Q91 22 98 39Q86 31 83 50Q74 43 68 56"
            fill="none"
            stroke="#b994a1"
            strokeWidth="0.85"
            strokeLinejoin="round"
          />
          <path
            d="M73 29Q80 17 95 9M73 29Q85 29 98 39M73 29Q80 38 83 50M73 29Q70 42 68 56"
            fill="none"
            stroke="#b18a99"
            strokeWidth="0.85"
            strokeLinecap="round"
          />
          <path
            d="M75 28Q77 23 74 21Q71 20 72 25"
            fill="none"
            stroke="#dac1b2"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          <path
            d="M84 22Q81 26 78 28M89 34Q83 31 77 32M79 40L75 34M71 43L72 35"
            fill="none"
            stroke="#d2a7b1"
            strokeOpacity="0.28"
            strokeWidth="0.45"
          />
        </g>
      </g>

      <path
        d="M38 36L35 41L38 44L35 48L38 50L37 55L41 55L40 60L46 58L50 62L54 58L60 60L59 55L63 55L62 50L65 48L62 44L65 41L62 36Z"
        fill={`url(#${id}-fur)`}
        stroke="#a58d9c"
        strokeWidth="0.65"
      />
      <path
        d="M44 43Q50 39 56 43L54 47L56 49L52 53L50 57L47 53L44 50L46 47Z"
        fill="#b6a0a4"
        opacity="0.32"
      />
      <g data-bat-part={BatPart.Wrap} opacity="0">
        <path
          d="M38 34Q26 43 38 58Q48 66 58 57L62 41L55 34Q53 44 38 34Z"
          fill={`url(#${id}-blanket)`}
          stroke="#bea0ae"
          strokeWidth="0.8"
        />
        <path
          d="M60 36Q63 49 38 56Q49 61 58 57L63 42Z"
          fill="#483046"
          stroke="#b1859d"
          strokeWidth="0.65"
        />
        <path
          d="M37 41Q44 49 57 50M35 46Q40 53 47 56"
          fill="none"
          stroke="#d4a4b7"
          strokeOpacity="0.4"
          strokeWidth="0.65"
        />
      </g>

      <path
        d="M38 29Q30 19 33 6Q43 11 45 22L55 22Q57 11 67 6Q70 19 62 29L65 32L62 34L64 37L60 40L55 42L50 44L45 42L40 40L36 37L38 34L35 32Z"
        fill={`url(#${id}-fur)`}
        stroke="#bd9eab"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
      <path
        d="M35 11Q35 22 41 27Q40 17 35 11ZM65 11Q65 22 59 27Q60 17 65 11Z"
        fill="#b0808e"
      />
      <path
        d="M43 24L47 21L49 24L51 21L55 24M39 36L42 37M61 36L58 37"
        fill="none"
        stroke="#bc9fad"
        strokeOpacity="0.65"
        strokeWidth="0.65"
      />

      <g data-bat-part={BatPart.Sleep} opacity={sleeper ? 1 : 0}>
        <path
          d="M40 32Q44 36 47 32M53 32Q56 36 60 32"
          fill="none"
          stroke="#eed2ae"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path d="M41 35L40 36M59 35L60 36" stroke="#d5b5ab" strokeWidth="0.7" />
      </g>
      <g data-bat-part={BatPart.Eye} opacity={sleeper ? 0 : 1}>
        {sleeper ? (
          <path
            d="M40 32Q44 36 47 32"
            fill="none"
            stroke="#eed2ae"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        ) : (
          <ellipse cx="44" cy="32" rx="4" ry="3.5" fill={`url(#${id}-eye)`} />
        )}
        <ellipse cx="56" cy="32" rx="4" ry="3.5" fill={`url(#${id}-eye)`} />
        <g data-bat-part={BatPart.Gaze}>
          {!sleeper && (
            <ellipse cx="44" cy="32.4" rx="1.3" ry="2.6" fill="#211d2b" />
          )}
          <ellipse cx="56" cy="32.4" rx="1.3" ry="2.6" fill="#211d2b" />
          {!sleeper && <circle cx="43.5" cy="31.1" r="0.55" fill="#fff7e4" />}
          <circle cx="55.5" cy="31.1" r="0.55" fill="#fff7e4" />
        </g>
      </g>
      <path d="M47 36Q50 34 53 36L50 38Z" fill="#bd969f" />
      <path
        d="M47 39Q50 41 53 39"
        fill="none"
        stroke="#dcc5b8"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      <g data-bat-part={BatPart.Yawn} opacity="0">
        <ellipse
          cx="50"
          cy="40"
          rx="3.5"
          ry="4.4"
          fill="#201722"
          stroke="#ab8297"
          strokeWidth="0.65"
        />
        <path
          d="M47.5 36.8L49 39L49.2 36M52.5 36.8L51 39L50.8 36"
          fill="#f5dfbd"
        />
        <ellipse cx="50" cy="42.2" rx="1.7" ry="1.1" fill="#c37d91" />
      </g>

      <path
        d="M45 57L45 63M55 57L55 63"
        stroke="#a494a5"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M45 62Q40 63 41 66M45 63L45 66M45 63Q49 63 49 66M55 62Q60 63 59 66M55 63L55 66M55 63Q51 63 51 66"
        fill="none"
        stroke="#eadac7"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default memo(HalloweenBat);
