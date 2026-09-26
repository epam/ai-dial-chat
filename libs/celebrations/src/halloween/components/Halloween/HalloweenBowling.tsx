import { useEffect, useId, useRef, useState, type FC } from 'react';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { getCelebrationHistoryRows } from '../../../utils/celebration-history';
import { HalloweenScene } from '../../types/halloween';
import {
  animateBowling,
  buildBowlingPlan,
  type BowlingPlan,
} from '../../utils/halloween-bowling';
import styles from './HalloweenBowling.module.scss';

/** Roll into measured history rows and launch each copy at its own contact time. */
const HalloweenBowling: FC = () => {
  const id = useId();
  const reducedMotion = useReducedMotion();
  const { anchors } = useCelebrationEnvironment();
  const actorRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<SVGGElement>(null);
  const copiesRef = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState<BowlingPlan | null>(null);
  const [ready, setReady] = useState(false);
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    setReady(true);
    setEnded(false);
    setPlan(null);
    const actor = actorRef.current;
    const spin = spinRef.current;
    const host = copiesRef.current;
    if (
      reducedMotion ||
      !actor ||
      !spin ||
      !host ||
      typeof actor.animate !== 'function' ||
      typeof spin.animate !== 'function'
    )
      return;
    const viewport = document.documentElement;
    const next = buildBowlingPlan(
      getCelebrationHistoryRows(anchors),
      viewport.clientWidth,
      viewport.clientHeight,
    );
    if (!next?.hits.length) return;
    setPlan(next);
    return animateBowling(next, host, actor, spin, () => setEnded(true));
  }, [anchors, reducedMotion]);
  const width = plan ? (plan.radius * 160) / 64 : 110;
  return (
    <div
      className={styles.scene}
      data-halloween-scene={HalloweenScene.Bowling}
      aria-hidden="true"
    >
      <div ref={copiesRef} className={styles.scene} inert />
      <div
        ref={actorRef}
        className={styles.actor}
        style={{
          visibility:
            !ready || (ended && !reducedMotion) ? 'hidden' : undefined,
          ...(plan && !reducedMotion
            ? {
                left: plan.startX - width / 2,
                right: 'auto',
                top: plan.y - (width * 83) / 160,
                width,
              }
            : {}),
        }}
      >
        <svg viewBox="0 0 160 160" focusable="false">
          <ellipse
            cx="80"
            cy="150"
            rx="61"
            ry="7"
            fill="#0e1921"
            opacity="0.3"
          />
          <g ref={spinRef} className={styles.spin}>
            <defs>
              <radialGradient id={`${id}-rind`} cx="0.35" cy="0.3">
                <stop stopColor="#f1b666" />
                <stop offset="0.4" stopColor="#ce792f" />
                <stop offset="0.8" stopColor="#995127" />
                <stop offset="1" stopColor="#512f27" />
              </radialGradient>
              <radialGradient id={`${id}-lantern`}>
                <stop stopColor="#fff4c2" />
                <stop offset="1" stopColor="#deb657" />
              </radialGradient>
            </defs>
            <g transform="translate(-80 -120)">
              <g>
                <path
                  d="M151 146Q155 131 170 127L178 135Q166 136 166 151"
                  fill="#596646"
                  stroke="#9c9c64"
                  strokeWidth="2"
                />
                <circle
                  cx="160"
                  cy="203"
                  r="64"
                  data-bowling-body="true"
                  fill={`url(#${id}-rind)`}
                  stroke="#bd7e43"
                  strokeWidth="2"
                />
                <path
                  d="M135 150Q93 194 134 255M158 153Q138 194 159 254M179 149Q217 195 183 255M201 155Q240 194 208 245"
                  fill="none"
                  stroke="#663920"
                  strokeWidth="2"
                  opacity="0.65"
                />
                <path
                  d="M105 187L144 192L130 177ZM174 190L211 184L188 173ZM112 212L130 222L140 215L151 231L165 220L178 225L191 214L207 209Q179 259 143 240Q121 232 112 212Z"
                  fill={`url(#${id}-lantern)`}
                  stroke="#623d28"
                  strokeWidth="2"
                />
                <path
                  d="M101 171Q112 153 127 153"
                  fill="none"
                  stroke="#f9d096"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.65"
                />
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
};

export default HalloweenBowling;
