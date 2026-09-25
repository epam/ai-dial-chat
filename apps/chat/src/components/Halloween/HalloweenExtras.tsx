import { useId, useState, type CSSProperties, type FC } from 'react';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import styles from './HalloweenExtras.module.scss';

/** A brass-trimmed midnight locomotive, three lantern wagons and fading steam. */
export const HalloweenTrain: FC = () => {
  const id = useId();
  return (
    <div
      className={styles.scene}
      data-halloween-scene="train"
      aria-hidden="true"
    >
      <div className={styles.train}>
        <svg viewBox="0 0 640 170" focusable="false">
          <defs>
            <linearGradient id={`${id}-metal`} x2="0.2" y2="1">
              <stop stopColor="#7a9b89" />
              <stop offset="0.45" stopColor="#29453f" />
              <stop offset="1" stopColor="#101c26" />
            </linearGradient>
            <radialGradient id={`${id}-lantern`} cx="38%" cy="30%">
              <stop stopColor="#ffc16b" />
              <stop offset="0.5" stopColor="#d66c2b" />
              <stop offset="1" stopColor="#69302c" />
            </radialGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((n) => (
            <ellipse
              key={n}
              className={styles.steam}
              style={{ animationDelay: `${n * 0.37}s` }}
              cx="92"
              cy="66"
              rx="17"
              ry="10"
              fill="#b2e4c0"
            />
          ))}
          <path
            d="M28 132H628"
            stroke="#b8e8c9"
            strokeWidth="2"
            opacity="0.5"
          />
          <path
            d="M34 120L52 87H156V56H234V122Z"
            fill={`url(#${id}-metal)`}
            stroke="#b2c0a0"
            strokeWidth="2"
          />
          <path
            d="M77 90V61H107V91M70 61H114M150 55H243"
            fill={`url(#${id}-metal)`}
            stroke="#bea77d"
            strokeWidth="5"
          />
          <rect
            x="169"
            y="64"
            width="47"
            height="35"
            rx="5"
            fill="#b3eac3"
            opacity="0.85"
          />
          <path
            d="M178 99V83Q191 58 203 83V99L197 94L190 100L185 94Z"
            fill="#ebf8d9"
          />
          <path d="M185 82V87M196 82V87" stroke="#24494a" strokeWidth="3" />
          <path
            d="M57 99H151M57 109H151M233 123H621"
            stroke="#af9775"
            strokeWidth="3"
          />
          <circle
            cx="51"
            cy="103"
            r="9"
            fill="#ffe9a4"
            stroke="#a18558"
            strokeWidth="3"
          />
          {[285, 405, 525].map((x) => (
            <g key={x}>
              <path
                d={`M${x - 27} 104H${x + 65}L${x + 58} 124H${x - 21}Z`}
                fill={`url(#${id}-metal)`}
                stroke="#adad84"
                strokeWidth="2"
              />
              <ellipse
                cx={x + 19}
                cy="85"
                rx="35"
                ry="30"
                fill={`url(#${id}-lantern)`}
                stroke="#e5a461"
              />
              <path
                d={`M${x + 17} 58Q${x + 9} 43 ${x + 25} 46M${x + 2} 62Q${x - 9} 85 ${x + 2} 106M${x + 34} 62Q${x + 45} 85 ${x + 34} 106`}
                fill="none"
                stroke="#724332"
                strokeWidth="3"
              />
              <path
                d={`M${x + 1} 79L${x + 11} 83L${x} 87ZM${x + 27} 83L${x + 37} 79L${x + 38} 87ZM${x + 1} 93L${x + 12} 97L${x + 18} 94L${x + 25} 98L${x + 37} 92Q${x + 20} 115 ${x + 1} 93Z`}
                fill="#ffdc86"
              />
            </g>
          ))}
          {[78, 139, 201, 281, 330, 401, 450, 521, 570].map((x) => (
            <g key={x} transform={`translate(${x} 130)`}>
              <g className={styles.wheel}>
                <circle
                  r="15"
                  fill="#142d30"
                  stroke="#c5ba8c"
                  strokeWidth="3"
                />
                <path
                  d="M-12 0H12M0-12V12M-8-8L8 8M8-8L-8 8"
                  stroke="#779f90"
                  strokeWidth="2"
                />
                <circle r="4" fill="#e3d5a3" />
              </g>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};

/** Perched silhouettes turn their heads before taking off together. */
export const HalloweenRavens: FC = () => {
  const id = useId();
  const isMobile = useIsMobile();
  const [birds] = useState(() =>
    Array.from(
      { length: 8 },
      (_, index) =>
        ({
          '--x': `${6 + Math.random() * 78}vw`,
          '--y': index % 2 ? 'calc(100dvh - 58px)' : '8px',
          '--delay': `${index * 0.12}s`,
          '--size': `${35 + Math.random() * 16}px`,
          '--escape-x': `${index % 2 ? 75 : -75}vw`,
          '--facing': index % 2 ? 1 : -1,
        }) as CSSProperties,
    ),
  );
  return (
    <div
      className={styles.scene}
      data-halloween-scene="ravens"
      aria-hidden="true"
    >
      {birds.slice(0, isMobile ? 5 : 8).map((style, index) => (
        <span key={index} style={style} className={styles.raven}>
          <svg viewBox="0 0 100 100" focusable="false">
            <defs>
              <linearGradient id={`${id}-feather-${index}`} x2="0.7" y2="1">
                <stop stopColor="#868c9c" />
                <stop offset="0.38" stopColor="#3e4358" />
                <stop offset="1" stopColor="#171d2b" />
              </linearGradient>
            </defs>
            <path
              d="M40 65L23 93L46 80L50 90L60 65Z"
              fill="#202735"
              stroke="#8c929b"
              strokeWidth="0.7"
            />
            <ellipse
              cx="48"
              cy="56"
              rx="21"
              ry="27"
              fill={`url(#${id}-feather-${index})`}
            />
            <g className={styles.ravenWing}>
              <path
                d="M49 36Q12 13 4 22L12 40L9 49L18 48L16 57L28 52L30 62L49 68Z"
                fill={`url(#${id}-feather-${index})`}
                stroke="#8e9aac"
                strokeWidth="0.8"
              />
              <path
                d="M15 30L42 55M16 44L40 59M26 51L42 62"
                stroke="#a3a8b4"
                strokeOpacity="0.4"
              />
            </g>
            <g className={styles.ravenHead}>
              <path
                d="M40 38Q30 16 50 13Q69 10 72 28L93 36L70 37L65 46Z"
                fill={`url(#${id}-feather-${index})`}
                stroke="#9198a8"
                strokeWidth="0.7"
              />
              <path d="M72 29L93 36L72 34" fill="#9a998d" />
              <circle cx="63" cy="25" r="2.1" fill="#e6d5a0" />
            </g>
            <path
              d="M41 77L39 88L30 90M39 88L46 90M55 77L57 88L49 91M57 88L64 90"
              fill="none"
              stroke="#b3b1a2"
              strokeWidth="2"
            />
          </svg>
        </span>
      ))}
    </div>
  );
};

/** Small wrapped sweets, candy corn and lanterns tumble and bounce away. */
export const HalloweenCandy: FC = () => {
  const isMobile = useIsMobile();
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
