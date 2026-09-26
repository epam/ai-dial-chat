import { memo, useId, useMemo, type FC } from 'react';
import FlyingCharacters from '../../../components/FlyingCharacters/FlyingCharacters';
import { HalloweenScene } from '../../types/halloween';
import {
  buildHalloweenBatFlight,
  buildHalloweenWitchFlight,
} from '../../utils/halloween';
import styles from './Halloween.module.scss';

/** A small bat with articulated wings and warm pinprick eyes. */
const Bat: FC = () => {
  const id = useId();
  return (
    <svg viewBox="0 0 80 48" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-wing`} x2="0.3" y2="1">
          <stop stopColor="#83718c" />
          <stop offset="0.5" stopColor="#423349" />
          <stop offset="1" stopColor="#1a1725" />
        </linearGradient>
      </defs>
      <g className={styles.batWing}>
        <path
          d="M38 25Q22 6 2 5Q11 15 7 29Q18 20 21 36Q27 27 34 39L40 30Z"
          fill={`url(#${id}-wing)`}
          stroke="#b9a0b7"
          strokeWidth="0.6"
        />
        <path
          d="M4 6L37 26M8 28L37 27M22 35L38 28"
          stroke="#c59fb2"
          strokeOpacity="0.35"
          strokeWidth="0.6"
        />
        <path
          d="M42 25Q58 6 78 5Q69 15 73 29Q62 20 59 36Q53 27 46 39L40 30Z"
          fill={`url(#${id}-wing)`}
          stroke="#b9a0b7"
          strokeWidth="0.6"
        />
        <path
          d="M76 6L43 26M72 28L43 27M58 35L42 28"
          stroke="#c59fb2"
          strokeOpacity="0.35"
          strokeWidth="0.6"
        />
      </g>
      <path
        d="M34 22L32 12L38 17L42 17L48 12L46 22Q49 35 40 42Q31 35 34 22Z"
        fill="#25202f"
        stroke="#a395aa"
        strokeWidth="0.7"
      />
      <path
        d="M37 22L39 23M43 22L41 23"
        stroke="#f2c974"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
};

/** A broom rider in profile, with a bent hat, windblown cloak and straw broom. */
const Witch: FC = () => {
  const id = useId();
  return (
    <svg viewBox="0 0 112 80" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-cloak`} x2="0.8" y2="1">
          <stop stopColor="#9782ad" />
          <stop offset="0.35" stopColor="#574263" />
          <stop offset="1" stopColor="#211d30" />
        </linearGradient>
      </defs>
      <path
        d="M18 61L103 45"
        stroke="#6a4531"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M7 58Q18 60 30 55L32 64Q20 64 8 72L12 65L5 66Z"
        fill="#bd9756"
        stroke="#765633"
        strokeWidth="0.8"
      />
      <path
        d="M11 62L29 58M12 66L30 60M16 68L30 62"
        stroke="#f4d394"
        strokeWidth="0.65"
      />
      <path d="M29 56L31 64" stroke="#625049" strokeWidth="2" />
      <path
        d="M51 50L66 55L62 65L75 69L64 72L55 67L58 58L44 57Z"
        fill="#262031"
        stroke="#b6a1b5"
        strokeWidth="0.6"
      />
      <path
        d="M56 29Q47 29 40 37Q33 45 21 43L29 50L20 53Q43 63 62 52L56 42L69 45L77 42L72 39L63 40Z"
        fill={`url(#${id}-cloak)`}
        stroke="#ac93ba"
        strokeWidth="0.65"
      />
      <path
        d="M44 38Q39 47 30 49M47 43L56 53"
        fill="none"
        stroke="#b9a0cb"
        strokeOpacity="0.4"
      />
      <path
        d="M55 18Q66 16 67 23L72 28L66 29L65 34L56 32L52 24Z"
        fill="#bcae96"
      />
      <path d="M55 22Q51 33 46 31L50 35L56 31L58 22" fill="#a46b42" />
      <path d="M65 23L67 23" stroke="#302631" strokeWidth="1.1" />
      <path
        d="M44 20L55 2Q60 9 71 6L63 12L65 22Z"
        fill={`url(#${id}-cloak)`}
        stroke="#ac93ba"
        strokeWidth="0.6"
      />
      <path d="M47 16L63 18L65 22L45 20Z" fill="#bb733e" />
      <path
        d="M37 22Q47 18 53 21Q64 26 74 22L76 26Q52 32 37 22Z"
        fill="#34253e"
        stroke="#ac93ba"
        strokeWidth="0.6"
      />
    </svg>
  );
};

interface Props {
  burst: HalloweenScene.Bats | HalloweenScene.Witches;
}

/** Staggered flights share viewport paths; each character keeps its own movement. */
const HalloweenNightFlight: FC<Props> = ({ burst }) => {
  const isWitch = burst === HalloweenScene.Witches;
  const flights = useMemo(
    () => (isWitch ? buildHalloweenWitchFlight() : buildHalloweenBatFlight()),
    [isWitch],
  );
  return (
    <FlyingCharacters flights={flights} Character={isWitch ? Witch : Bat} />
  );
};

export default memo(HalloweenNightFlight);
