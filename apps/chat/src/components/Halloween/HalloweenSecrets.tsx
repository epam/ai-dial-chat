import {
  useId,
  useState,
  useEffect,
  useRef,
  type CSSProperties,
  type FC,
  type ReactNode,
} from 'react';
import { useReducedMotion } from '../../hooks/celebration/useReducedMotion';
import { HalloweenBurst } from '../../types/halloween';
import {
  animateSecretSceneHistory,
  getSecretSceneTargets,
} from '../../utils/halloween-secret-history';
import styles from './HalloweenSecrets.module.scss';

interface SceneProps {
  scene: HalloweenBurst;
  children: ReactNode;
}

/* A bounded stage keeps both the character and its particles on screen.
   Placement is sampled once, so notification/context renders never move it. */
const SecretScene: FC<SceneProps> = ({ scene, children }) => {
  const reducedMotion = useReducedMotion();
  const stageRef = useRef<SVGSVGElement>(null);
  const copiesRef = useRef<HTMLDivElement>(null);
  const [position] = useState(
    () =>
      ({
        '--place-x': 0.12 + Math.random() * 0.76,
        '--place-y': 0.12 + Math.random() * 0.6,
      }) as CSSProperties,
  );
  useEffect(() => {
    if (
      reducedMotion ||
      !stageRef.current ||
      !copiesRef.current ||
      typeof copiesRef.current.animate !== 'function'
    )
      return;
    const targets = getSecretSceneTargets();
    const stage = stageRef.current.getBoundingClientRect();
    return animateSecretSceneHistory(scene, targets, copiesRef.current, stage);
  }, [scene, reducedMotion]);
  return (
    <div
      className={styles.scene}
      data-halloween-scene={scene}
      aria-hidden="true"
    >
      <div ref={copiesRef} className={styles.scene} inert />
      <svg
        ref={stageRef}
        className={styles.stage}
        style={position}
        viewBox="0 0 320 320"
        focusable="false"
      >
        <g className={styles.art}>{children}</g>
      </svg>
    </div>
  );
};

/** A cast-iron pot releases little faces, then vanishes in a final puff. */
export const HalloweenCauldron: FC = () => {
  const id = useId();
  return (
    <SecretScene scene={HalloweenBurst.Cauldron}>
      <defs>
        <linearGradient id={`${id}-iron`} x1="0" y1="0" x2="1" y2="0.6">
          <stop stopColor="#111d24" />
          <stop offset="0.3" stopColor="#526562" />
          <stop offset="0.55" stopColor="#283b3a" />
          <stop offset="1" stopColor="#101c26" />
        </linearGradient>
        <radialGradient id={`${id}-potion`}>
          <stop stopColor="#e5ffac" />
          <stop offset="0.55" stopColor="#96cc57" />
          <stop offset="1" stopColor="#365c39" />
        </radialGradient>
        <radialGradient id={`${id}-bubble`} cx="0.3" cy="0.25">
          <stop stopColor="#f2ffdf" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#b7e78b" stopOpacity="0.65" />
          <stop offset="1" stopColor="#50956c" stopOpacity="0.2" />
        </radialGradient>
      </defs>
      <g className={styles.pot}>
        <ellipse
          cx="160"
          cy="279"
          rx="78"
          ry="12"
          fill="#172b28"
          opacity="0.28"
        />
        <path
          d="M114 254L100 282H115L132 258M189 258L205 282H220L204 253"
          fill={`url(#${id}-iron)`}
          stroke="#75867b"
          strokeWidth="2"
        />
        <path
          d="M89 188C46 173 48 224 83 220M231 188C274 173 272 224 237 220"
          fill="none"
          stroke="#718079"
          strokeWidth="8"
        />
        <path
          d="M92 182C65 211 77 266 117 275Q160 288 203 275C243 266 255 211 228 182Z"
          fill={`url(#${id}-iron)`}
          stroke="#87958b"
          strokeWidth="2"
        />
        <path
          d="M97 216Q89 252 121 264M105 223L108 248"
          fill="none"
          stroke="#b3c6ac"
          strokeWidth="3"
          opacity="0.35"
          strokeLinecap="round"
        />
        <ellipse
          cx="160"
          cy="184"
          rx="74"
          ry="23"
          fill="#172c2b"
          stroke="#a5b79a"
          strokeWidth="5"
        />
        <ellipse
          cx="160"
          cy="182"
          rx="66"
          ry="16"
          fill={`url(#${id}-potion)`}
        />
        <path
          d="M112 185Q135 174 150 183T206 180"
          fill="none"
          stroke="#edffc4"
          strokeWidth="2"
          opacity="0.7"
        />
        <path
          d="M158 213L169 232L159 251L149 232ZM137 230H180"
          fill="none"
          stroke="#b3aa7f"
          strokeWidth="2"
        />
        {[119, 152, 189].map((x, index) => (
          <ellipse
            key={x}
            cx={x}
            cy={180 + (index % 2) * 4}
            rx="8"
            ry="4"
            className={styles.simmer}
            style={{ '--delay': `${index * 0.35}s` } as CSSProperties}
            fill="#e2ffaf"
          />
        ))}
      </g>
      {Array.from({ length: 8 }, (_, index) => (
        <g
          key={index}
          transform={`translate(${112 + ((index * 31) % 98)} 177)`}
        >
          <g
            className={styles.bubble}
            style={
              {
                '--delay': `${0.6 + index * 0.53}s`,
                '--drift': `${(index % 2 ? 1 : -1) * (12 + index * 3)}px`,
              } as CSSProperties
            }
          >
            <circle
              r={12 + (index % 3) * 3}
              fill={`url(#${id}-bubble)`}
              stroke="#c2f6a0"
              strokeWidth="1.3"
            />
            <path
              d="M-9-4Q-8-10-2-11"
              stroke="#f1ffdc"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <g className={styles.bubbleFace} fill="#254834">
              <ellipse cx="-5" cy="-1" rx="2" ry="3" />
              <ellipse cx="5" cy="-1" rx="2" ry="3" />
              <path
                d="M-4 5Q0 10 4 5"
                fill="none"
                stroke="#254834"
                strokeWidth="1.5"
              />
            </g>
          </g>
        </g>
      ))}
      {[0, 1, 2].map((index) => (
        <g key={index} transform={`translate(${124 + index * 36} 229)`}>
          <g
            className={styles.smoke}
            style={{ '--delay': `${5.9 + index * 0.12}s` } as CSSProperties}
            fill="#a6c2a1"
            opacity="0.5"
          >
            <circle r="27" />
            <circle cx="-20" cy="8" r="21" />
            <circle cx="21" cy="4" r="24" />
          </g>
        </g>
      ))}
    </SecretScene>
  );
};
