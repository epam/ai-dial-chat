import { memo, useId, useMemo, type FC } from 'react';
import FlyingCharacters from '../../../components/FlyingCharacters/FlyingCharacters';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import { buildFlyingCharacterPaths } from '../../../utils/flying-characters';

/** A compact sleigh and reindeer silhouette with warm metallic highlights. */
const Sleigh: FC = () => {
  const id = useId();
  return (
    <svg viewBox="0 0 180 95" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-sleigh`} x2="0.7" y2="1">
          <stop stopColor="#e28487" />
          <stop offset="0.4" stopColor="#aa3f59" />
          <stop offset="1" stopColor="#632e47" />
        </linearGradient>
      </defs>
      <path
        d="M68 61Q93 63 116 43"
        stroke="#dbbd77"
        strokeWidth="1.4"
        fill="none"
      />
      <rect x="19" y="37" width="22" height="25" rx="2" fill="#479b8c" />
      <path d="M30 37V62M19 44H41" stroke="#f3d68a" strokeWidth="4" />
      <path d="M35 36L59 29L66 53L43 60Z" fill="#dbb569" />
      <path d="M47 32L55 57M39 45L62 39" stroke="#f4dfb2" strokeWidth="4" />
      <path
        d="M14 51Q23 61 47 57L64 49Q69 43 76 44L73 59Q67 75 31 72L23 64L18 66Z"
        fill={`url(#${id}-sleigh)`}
        stroke="#e5ba7b"
        strokeWidth="1.1"
      />
      <path
        d="M30 71L34 79M61 68L65 77M17 80Q47 87 80 73Q86 69 82 65"
        fill="none"
        stroke="#f3d395"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M110 49L102 56L94 55M113 50L110 62L98 67M132 46L143 52L154 48M133 43L141 43L149 35"
        fill="none"
        stroke="#af805b"
        strokeWidth="4.1"
        strokeLinecap="round"
      />
      <path
        d="M108 40Q118 32 131 36L144 26L146 15L154 18L157 27L150 36L138 47Q121 56 107 48Z"
        fill="#ae805b"
        stroke="#e9cda7"
        strokeWidth="0.7"
      />
      <path
        d="M145 19L136 12L138 6M139 14L131 15M151 20L155 9L152 3M155 11L163 6"
        fill="none"
        stroke="#d4b58a"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M144 21L136 18L140 27" fill="#c99d74" />
      <circle cx="153" cy="25" r="1.2" fill="#291d31" />
      <circle cx="157" cy="28" r="2.1" fill="#d6817c" />
      <path d="M110 41L103 35L104 45" fill="#c99d74" />
      <path d="M131 35L138 44" stroke="#d14f5c" strokeWidth="3.5" />
      <circle cx="138" cy="44" r="2" fill="#ffe1a0" />
      <path
        d="M6 35L7 39L11 40L7 41L6 45L5 41L1 40L5 39M91 17L92 21L96 22L92 23L91 27L90 23L86 22L90 21"
        fill="#e7d5a4"
        opacity="0.75"
      />
    </svg>
  );
};

const NewYearSleigh: FC = () => {
  const isMobile = useCelebrationEnvironment().isMobile;
  const flights = useMemo(
    () =>
      buildFlyingCharacterPaths({
        count: isMobile ? 2 : 3,
        sizesPx: isMobile ? [100, 115] : [125, 145, 165],
        durationSeconds: 8.4,
        staggerSeconds: 0.85,
      }),
    [isMobile],
  );
  return <FlyingCharacters flights={flights} Character={Sleigh} />;
};

export default memo(NewYearSleigh);
