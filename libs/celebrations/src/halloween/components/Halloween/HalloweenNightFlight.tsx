import { memo, useId, useMemo, type FC } from 'react';
import FlyingCharacters from '../../../components/FlyingCharacters/FlyingCharacters';
import { buildHalloweenBatFlight } from '../../utils/halloween';
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

/** Decorative bat fallback, also sharing trajectories with New Year sleighs. */
const HalloweenNightFlight: FC = () => {
  const flights = useMemo(() => buildHalloweenBatFlight(), []);
  return <FlyingCharacters flights={flights} Character={Bat} />;
};

export default memo(HalloweenNightFlight);
