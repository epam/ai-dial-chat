import { useId, type CSSProperties, type FC } from 'react';
import styles from './HalloweenExtras.module.scss';

const Skeleton: FC = () => {
  const id = useId();
  return (
    <svg viewBox="0 0 100 170" focusable="false">
      <defs>
        <linearGradient id={`${id}-bone`} x2="1" y2="1">
          <stop stopColor="#f7efd3" />
          <stop offset="0.65" stopColor="#b6b6a0" />
          <stop offset="1" stopColor="#777e79" />
        </linearGradient>
      </defs>
      <g
        className={styles.skeletonBody}
        fill="none"
        stroke={`url(#${id}-bone)`}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g className={styles.skeletonLeftArm}>
          <path d="M36 58L15 74L8 50M8 50L3 41M8 50L8 37M8 50L14 40" />
          <circle cx="15" cy="74" r="3" />
        </g>
        <g className={styles.skeletonRightArm}>
          <path d="M64 58L85 74L94 50M94 50L87 40M94 50L96 37M94 50L100 43" />
          <circle cx="85" cy="74" r="3" />
        </g>
        <path d="M50 44V97M32 57Q50 48 68 57M34 66Q50 76 66 66M33 77Q50 87 67 77M37 89Q50 97 63 89M34 99L50 108L66 99L61 118H39Z" />
        <g className={styles.skeletonLeftLeg}>
          <path d="M41 115L33 137L24 156L13 158" />
          <circle cx="33" cy="137" r="3" />
        </g>
        <g className={styles.skeletonRightLeg}>
          <path d="M59 115L68 137L76 156L88 157" />
          <circle cx="68" cy="137" r="3" />
        </g>
        <g className={styles.skeletonSkull} strokeWidth="1.2">
          <path
            d="M29 29Q25 6 50 5Q75 6 71 29L65 36V45H35V36Z"
            fill={`url(#${id}-bone)`}
          />
          <ellipse cx="39" cy="25" rx="7" ry="8" fill="#273d3b" />
          <ellipse cx="61" cy="25" rx="7" ry="8" fill="#273d3b" />
          <circle cx="40" cy="25" r="2" fill="#c4eba4" stroke="none" />
          <circle cx="60" cy="25" r="2" fill="#c4eba4" stroke="none" />
          <path d="M50 30L46 36H54Z" fill="#3a4c45" stroke="none" />
          <path
            d="M39 39V45M46 40V45M54 40V45M61 39V45M55 7L52 14L57 18"
            stroke="#68746a"
          />
        </g>
      </g>
    </svg>
  );
};

/** Two little dancers peek over the bottom edge, dance, then duck away. */
export const HalloweenSkeletons: FC = () => (
  <div
    className={styles.scene}
    data-halloween-scene="skeletons"
    aria-hidden="true"
  >
    {[0, 1].map((index) => (
      <span
        className={styles.skeleton}
        key={index}
        style={{ '--side': index, '--mirror': index ? -1 : 1 } as CSSProperties}
      >
        <Skeleton />
      </span>
    ))}
  </div>
);
