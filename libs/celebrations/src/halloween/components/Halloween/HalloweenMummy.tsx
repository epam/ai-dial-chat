import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FC,
} from 'react';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { HalloweenScene } from '../../types/halloween';
import {
  animateMummyPush,
  buildMummyPushLayout,
  getMummyComposerTarget,
  MUMMY_ANIMATION_MS,
  type MummyPushLayout,
} from '../../utils/halloween-mummy';
import styles from './HalloweenMummy.module.scss';

/** A stubborn visitor braces, fails twice, then shoves the composer out of view. */
const HalloweenMummy: FC = () => {
  const id = useId();
  const reducedMotion = useReducedMotion();
  const { anchors } = useCelebrationEnvironment();
  const copiesRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<MummyPushLayout | null>(null);
  const [ended, setEnded] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setEnded(false);
    setLayout(null);
    setReady(false);
    const actor = actorRef.current;
    const host = copiesRef.current;
    if (
      reducedMotion ||
      !actor ||
      !host ||
      typeof host.animate !== 'function'
    ) {
      setReady(true);
      return;
    }
    let disposed = false;
    let stop: (() => void) | undefined;
    const prepare = async () => {
      /* Measure after this commit: a disposed StrictMode rehearsal or an
         early interaction must never read layout. */
      await Promise.resolve();
      if (disposed) return;
      setReady(true);
      const target = anchors.composer
        ? getMummyComposerTarget(anchors.composer)
        : null;
      if (!target) return;
      const viewport = document.documentElement;
      const placement = buildMummyPushLayout(
        target.rect,
        viewport.clientWidth,
        viewport.clientHeight,
      );
      setLayout(placement);
      stop = animateMummyPush(target, host, actor, placement, () =>
        setEnded(true),
      );
    };
    prepare();
    return () => {
      disposed = true;
      stop?.();
    };
  }, [anchors, reducedMotion]);
  const isStatic = reducedMotion || !layout;
  return (
    <div
      className={styles.scene}
      data-halloween-scene={HalloweenScene.Mummy}
      data-static={isStatic}
      aria-hidden="true"
      style={{ '--mummy-duration': `${MUMMY_ANIMATION_MS}ms` } as CSSProperties}
    >
      <div ref={copiesRef} className={styles.scene} inert />
      <div
        ref={actorRef}
        className={styles.actor}
        style={{
          visibility:
            !ready || (ended && !reducedMotion) ? 'hidden' : undefined,
          ...(layout && !reducedMotion
            ? {
                left: layout.x,
                right: 'auto',
                top: layout.y,
                width: layout.width,
              }
            : {}),
        }}
      >
        <svg viewBox="0 0 200 260" focusable="false">
          <defs>
            <linearGradient id={`${id}-linen`} x1="0" y1="0" x2="1" y2="0.3">
              <stop stopColor="#76684e" />
              <stop offset="0.3" stopColor="#c7b891" />
              <stop offset="0.56" stopColor="#f3e6c4" />
              <stop offset="0.8" stopColor="#c6b38a" />
              <stop offset="1" stopColor="#8e7a56" />
            </linearGradient>
            <linearGradient id={`${id}-shadow`} x2="1" y2="0">
              <stop stopColor="#252822" />
              <stop offset="1" stopColor="#535441" />
            </linearGradient>
            <clipPath id={`${id}-torso`}>
              <path d="M76 94Q96 79 121 97L129 166Q108 185 73 167L63 133Z" />
            </clipPath>
            <clipPath id={`${id}-head`}>
              <path d="M91 62Q82 29 113 23Q146 17 151 46L150 69L159 76L149 81Q150 95 131 98L99 88Z" />
            </clipPath>
          </defs>
          <g
            transform={
              layout?.direction === -1 && !isStatic
                ? 'translate(200 0) scale(-1 1)'
                : undefined
            }
          >
            <ellipse
              cx="95"
              cy="249"
              rx="75"
              ry="7"
              fill="#142027"
              opacity="0.24"
            />
            <g
              fill={`url(#${id}-linen)`}
              stroke="#7d6e50"
              strokeWidth="1.5"
              strokeLinejoin="round"
            >
              <g className={styles.backLeg}>
                <path d="M91 160L91 189L62 222L56 237L76 242Q82 250 68 251L34 249Q28 246 33 238L44 214L67 166Z" />
                <path
                  d="M65 184L88 189M58 197L79 203M47 213L67 218M42 225L61 230M35 238L58 241"
                  fill="none"
                />
              </g>
              <g className={styles.frontLeg}>
                <path d="M99 162L124 163L137 204L123 233L142 239Q153 251 132 251L103 247Q96 244 101 233L112 202L96 181Z" />
                <path
                  d="M104 178L127 179M110 189L131 190M115 201L137 205M110 216L130 222M104 231L124 235M102 241L136 244"
                  fill="none"
                />
              </g>
              <g className={styles.torso}>
                <path d="M76 94Q96 79 121 97L129 166Q108 185 73 167L63 133Z" />
                <g clipPath={`url(#${id}-torso)`} fill="none">
                  {Array.from({ length: 9 }, (_, index) => (
                    <path
                      key={index}
                      d={`M57 ${89 + index * 11}L137 ${109 + index * 11}M60 ${111 + index * 11}L132 ${89 + index * 11}`}
                      opacity="0.65"
                    />
                  ))}
                </g>
                <path
                  d="M75 108Q79 123 74 142"
                  fill="none"
                  stroke="#f4e8c9"
                  strokeWidth="3"
                  opacity="0.6"
                />
                <g className={styles.head}>
                  <path d="M91 62Q82 29 113 23Q146 17 151 46L150 69L159 76L149 81Q150 95 131 98L99 88Z" />
                  <g clipPath={`url(#${id}-head)`} fill="none">
                    {[31, 44, 57, 70, 83, 96].map((y) => (
                      <path
                        key={y}
                        d={`M82 ${y}L160 ${y + 13}M84 ${y + 11}L155 ${y - 5}`}
                      />
                    ))}
                  </g>
                  <path
                    d="M105 54L151 53L150 70L105 67Z"
                    fill={`url(#${id}-shadow)`}
                  />
                  <g className={styles.eyes} stroke="none">
                    <ellipse cx="120" cy="61" rx="6" ry="4" fill="#e5ecaf" />
                    <ellipse cx="143" cy="61" rx="5" ry="4" fill="#e5ecaf" />
                    <ellipse cx="123" cy="61" rx="2" ry="3" fill="#354d36" />
                    <ellipse cx="146" cy="61" rx="1.7" ry="3" fill="#354d36" />
                  </g>
                  <path
                    d="M133 82L147 84M132 85L145 87"
                    fill="none"
                    stroke="#584d3c"
                    strokeWidth="2"
                  />
                </g>
                <path
                  className={styles.looseLinen}
                  d="M72 120Q39 136 35 158L45 164Q46 143 78 134Z"
                />
              </g>
              {/* Palms stay at x=187 while the torso strains behind them. */}
              <path d="M111 104Q132 95 148 105L177 109L182 103L189 104L191 122Q187 130 180 124L143 126L114 124Z" />
              <path d="M109 130L143 137L176 133L182 128L189 130L191 147Q187 155 180 148L143 155L108 147Z" />
              <path
                d="M122 102L122 124M132 102L133 125M145 105L144 126M156 107L155 127M168 109L166 126M182 109L189 111M181 115L190 117M122 133L120 150M134 136L133 153M147 137L149 154M160 136L162 152M172 134L175 150M182 136L190 138M182 143L190 145"
                fill="none"
              />
              <path
                d="M128 109L172 115M127 141L173 140"
                stroke="#f6ebcf"
                opacity="0.6"
                fill="none"
              />
            </g>
            <g
              className={styles.effort}
              fill="none"
              stroke="#d3e8c0"
              strokeWidth="2.3"
              strokeLinecap="round"
            >
              <path d="M161 32L169 26M165 43L177 41M70 69L61 65" />
              <path
                d="M73 42Q63 52 72 55Q80 54 73 42Z"
                fill="#b2d7c6"
                stroke="none"
              />
            </g>
            <g className={styles.dust} fill="#caba92" opacity="0">
              <ellipse cx="24" cy="246" rx="11" ry="4" />
              <circle cx="15" cy="239" r="3" />
              <circle cx="37" cy="238" r="4" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
};

export default HalloweenMummy;
