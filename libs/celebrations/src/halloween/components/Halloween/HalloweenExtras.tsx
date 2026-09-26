import { useId, useState, type CSSProperties, type FC } from 'react';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import styles from './HalloweenExtras.module.scss';

/** Small wrapped sweets, candy corn and lanterns tumble and bounce away. */
export const HalloweenCandy: FC = () => {
  const isMobile = useCelebrationEnvironment().isMobile;
  const [sweets] = useState(() =>
    Array.from(
      { length: 32 },
      (_, index) =>
        ({
          '--x': `${4 + Math.random() * 88}vw`,
          '--delay': `${Math.random() * 2.2}s`,
          '--rest-y': `${18 + Math.random() * 62}vh`,
          '--drift': `${(Math.random() - 0.5) * 16}vw`,
          '--turn': `${(Math.random() - 0.5) * 540}deg`,
          '--size': `${22 + Math.random() * 14}px`,
          '--sweet-color': ['#e79344', '#a78ec4', '#84bca0'][index % 3],
        }) as CSSProperties,
    ),
  );
  return (
    <div
      className={styles.scene}
      data-halloween-scene="candy"
      aria-hidden="true"
    >
      {sweets.slice(0, isMobile ? 18 : 32).map((style, index) => (
        <span className={styles.candy} key={index} style={style}>
          <svg viewBox="0 0 64 64" focusable="false">
            {index % 3 === 0 ? (
              <>
                <path
                  d="M7 22L21 27V38L6 44L10 32Z M57 22L43 27V38L58 44L54 32Z"
                  fill="var(--sweet-color)"
                  stroke="#ffe6ab"
                  strokeWidth="0.8"
                />
                <rect
                  x="18"
                  y="20"
                  width="28"
                  height="26"
                  rx="9"
                  fill="var(--sweet-color)"
                  stroke="#f4e1bf"
                />
                <path
                  d="M23 23L36 43M33 22L43 37"
                  stroke="#fff4d9"
                  strokeWidth="4"
                  strokeOpacity="0.6"
                />
              </>
            ) : index % 3 === 1 ? (
              <>
                <path
                  d="M27 10Q32 4 37 10L57 49Q60 57 51 58H13Q4 57 7 49Z"
                  fill="#f4c962"
                  stroke="#ad713a"
                />
                <path d="M17 30H47L56 48H8Z" fill="#e99042" />
                <path d="M27 10Q32 4 37 10L43 22H21Z" fill="#fff3d0" />
              </>
            ) : (
              <>
                <path
                  d="M31 17Q28 7 38 7"
                  fill="none"
                  stroke="#607c50"
                  strokeWidth="5"
                />
                <ellipse
                  cx="32"
                  cy="36"
                  rx="25"
                  ry="23"
                  fill="#dc8234"
                  stroke="#a34d2d"
                />
                <path
                  d="M24 16Q10 36 24 55M40 16Q54 36 40 55"
                  fill="none"
                  stroke="#ad572b"
                />
                <path
                  d="M17 30L27 34L17 37ZM47 30L37 34L47 37ZM18 42L30 46L33 43L37 46L47 41Q33 62 18 42Z"
                  fill="#ffe3a1"
                />
              </>
            )}
          </svg>
        </span>
      ))}
    </div>
  );
};

/** An unseen familiar crosses a winding path, leaving a brief grin at its end. */
export const HalloweenFootprints: FC = () => {
  const [path] = useState(() => {
    const y = 28 + Math.random() * 20;
    const reverse = Math.random() > 0.5;
    return Array.from(
      { length: 14 },
      (_, index) =>
        ({
          '--x': `${reverse ? 88 - index * 5.5 : 6 + index * 5.5}vw`,
          '--y': `${y + Math.sin(index * 0.4) * 12 + (index % 2 ? 4 : 0)}vh`,
          '--angle': `${(reverse ? -90 : 90) + Math.cos(index * 0.4) * 18}deg`,
          '--delay': `${index * 0.43}s`,
        }) as CSSProperties,
    );
  });
  return (
    <div
      className={styles.scene}
      data-halloween-scene="footprints"
      aria-hidden="true"
    >
      {path.map((style, index) => (
        <svg
          key={index}
          className={styles.paw}
          style={style}
          viewBox="0 0 40 45"
          focusable="false"
        >
          <path
            d="M13 22Q20 14 27 22L34 33Q30 41 20 36Q9 41 6 33Z"
            fill="#b4d5be"
          />
          <ellipse cx="7" cy="19" rx="4" ry="6" transform="rotate(-28 7 19)" />
          <ellipse cx="15" cy="10" rx="4" ry="6" />
          <ellipse cx="25" cy="10" rx="4" ry="6" />
          <ellipse cx="33" cy="19" rx="4" ry="6" transform="rotate(28 33 19)" />
        </svg>
      ))}
      <svg
        className={styles.hiddenGrin}
        style={path.at(-1)}
        viewBox="0 0 110 80"
        focusable="false"
      >
        <path
          d="M12 20Q30 4 45 22Q26 36 12 20ZM65 22Q80 4 98 20Q84 36 65 22Z"
          fill="#c9eab0"
        />
        <path d="M30 16V26M80 16V26" stroke="#182d31" strokeWidth="4" />
        <path d="M18 45Q54 65 92 43Q65 89 18 45Z" fill="#e8edc5" />
        <path
          d="M35 53L39 66M50 58L52 71M66 56L65 69M80 51L76 62"
          stroke="#2d4947"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
};

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
