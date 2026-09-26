import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FC,
} from 'react';
import { useReducedMotion } from '../../hooks/celebration/useReducedMotion';
import { HalloweenBurst } from '../../types/halloween';
import {
  animateMimic,
  buildMimicPlan,
  type MimicPlan,
} from '../../utils/halloween-mimic';
import { getSecretSceneTargets } from '../../utils/halloween-secret-history';
import tongueStyles from './HalloweenMimic.module.scss';
import styles from './HalloweenSecrets.module.scss';

/** A tongue wraps neighboring chats and retracts with its catch still attached. */
const HalloweenMimic: FC = () => {
  const id = useId();
  const reducedMotion = useReducedMotion();
  const stageRef = useRef<SVGSVGElement>(null);
  const copiesRef = useRef<HTMLDivElement>(null);
  const tongueRef = useRef<SVGGElement>(null);
  const loopRef = useRef<SVGGElement>(null);
  const backGripRef = useRef<SVGGElement>(null);
  const [plan, setPlan] = useState<MimicPlan | null>(null);
  const [ended, setEnded] = useState(false);
  const [position] = useState(
    () =>
      ({
        '--place-x': 0.12 + Math.random() * 0.76,
        '--place-y': 0.12 + Math.random() * 0.6,
      }) as CSSProperties,
  );
  useEffect(() => {
    setPlan(
      reducedMotion || !stageRef.current
        ? null
        : buildMimicPlan(
            getSecretSceneTargets(),
            stageRef.current.getBoundingClientRect(),
          ),
    );
  }, [reducedMotion]);
  useEffect(() => {
    setEnded(false);
    if (
      reducedMotion ||
      !plan ||
      !copiesRef.current ||
      !tongueRef.current ||
      !loopRef.current ||
      !backGripRef.current
    )
      return;
    return animateMimic(
      plan,
      copiesRef.current,
      tongueRef.current,
      loopRef.current,
      () => setEnded(true),
      backGripRef.current,
    );
  }, [plan, reducedMotion]);
  const halfHeight = plan ? plan.grab.height / 2 + 4 : 0;
  const bend = plan ? Math.min(38, plan.grab.width * 0.14) : 0;
  const backWrap = `M0 0 C${-bend * 1.6} ${halfHeight * 0.3} ${-bend * 1.8} ${-halfHeight * 0.6} ${-bend * 0.8} ${-halfHeight} C${bend * 0.1} ${-halfHeight - 7} ${bend * 0.7} ${-halfHeight - 4} ${bend * 0.9} ${-halfHeight + 3}`;
  const frontWrap = `M${bend * 0.9} ${-halfHeight + 3} C${bend * 1.5} ${-halfHeight * 0.72} ${-bend * 0.85} ${halfHeight * 0.28} ${-bend * 0.7} ${halfHeight - 4} C${-bend * 0.55} ${halfHeight + 8} ${bend * 0.65} ${halfHeight + 8} ${bend * 0.9} ${halfHeight - 3}`;
  const curl = `M${bend * 0.9} ${halfHeight - 3} C${bend * 1.2} ${halfHeight * 0.45} ${bend * 1.1} ${halfHeight * 0.18} ${bend * 0.65} ${halfHeight * 0.24} C${bend * 0.3} ${halfHeight * 0.3} ${bend * 0.6} ${halfHeight * 0.65} ${bend * 0.82} ${halfHeight * 0.54}`;
  return (
    <div
      className={styles.scene}
      data-halloween-scene={HalloweenBurst.Mimic}
      aria-hidden="true"
    >
      {plan && !reducedMotion && (
        <svg
          className={tongueStyles.tongueCanvas}
          focusable="false"
          style={{ visibility: ended ? 'hidden' : undefined }}
        >
          <defs>
            <mask
              id={`${id}-behind-chats`}
              maskUnits="userSpaceOnUse"
              x={plan.grab.x - plan.grab.width}
              y={plan.grab.y - plan.grab.height}
              width={plan.grab.width * 2}
              height={plan.grab.height * 2}
            >
              <rect
                x={plan.grab.x - plan.grab.width}
                y={plan.grab.y - plan.grab.height}
                width={plan.grab.width * 2}
                height={plan.grab.height * 2}
                fill="white"
              />
              <rect
                x={plan.grab.x - plan.grab.width / 2}
                y={plan.grab.y - plan.grab.height / 2}
                width={plan.grab.width}
                height={plan.grab.height}
                fill="black"
              />
            </mask>
          </defs>
          <g
            ref={backGripRef}
            className={tongueStyles.loop}
            style={{ transformOrigin: `${plan.grab.x}px ${plan.grab.y}px` }}
          >
            <g mask={`url(#${id}-behind-chats)`}>
              <g transform={`translate(${plan.grab.x} ${plan.grab.y})`}>
                <g data-mimic-wrap="back">
                  <path
                    d={backWrap}
                    pathLength="1"
                    stroke="#552634"
                    strokeWidth="22"
                  />
                  <path
                    d={backWrap}
                    pathLength="1"
                    stroke="#975165"
                    strokeWidth="15"
                  />
                  <path
                    d={backWrap}
                    pathLength="1"
                    stroke="#c67989"
                    strokeWidth="3"
                    opacity="0.5"
                  />
                </g>
              </g>
            </g>
          </g>
        </svg>
      )}
      <div ref={copiesRef} className={styles.scene} inert />
      <svg
        ref={stageRef}
        className={styles.stage}
        style={position}
        viewBox="0 0 320 320"
        focusable="false"
      >
        <g className={styles.art}>
          <defs>
            <linearGradient id={`${id}-wood`} x2="0.2" y2="1">
              <stop stopColor="#916849" />
              <stop offset="0.4" stopColor="#543c35" />
              <stop offset="1" stopColor="#322b32" />
            </linearGradient>
            <linearGradient id={`${id}-brass`} x2="1" y2="0.6">
              <stop stopColor="#e2c388" />
              <stop offset="0.5" stopColor="#86734f" />
              <stop offset="1" stopColor="#c4ae7e" />
            </linearGradient>
          </defs>
          <g className={styles.chest}>
            <ellipse
              cx="161"
              cy="271"
              rx="91"
              ry="12"
              fill="#101b27"
              opacity="0.3"
            />
            <path
              d="M69 195L90 260L238 260L253 195Z"
              fill={`url(#${id}-wood)`}
              stroke="#c1a06b"
              strokeWidth="2"
            />
            <path
              d="M80 210H242M85 234H239M105 216L147 220M172 247L225 242"
              fill="none"
              stroke="#251e26"
              strokeWidth="2"
            />
            <path
              d="M91 202L104 257M216 203L224 258"
              stroke={`url(#${id}-brass)`}
              strokeWidth="15"
            />
            {[215, 244].map((y) => (
              <g key={y} fill="#e2ce93">
                <circle cx={98 + (y - 215) / 6} cy={y} r="2.5" />
                <circle cx={218 + (y - 215) / 6} cy={y} r="2.5" />
              </g>
            ))}
            <ellipse
              cx="161"
              cy="199"
              rx="91"
              ry="23"
              fill="#271d2b"
              stroke="#987061"
              strokeWidth="4"
            />
            <path
              d="M91 205L104 188L111 210L125 191L136 215L148 194L158 217L172 193L184 214L197 191L207 210L222 186L231 204"
              fill="#e1d8b8"
              stroke="#a69f82"
            />
            <g className={styles.chestLid}>
              <path
                d="M70 186L81 119Q157 94 239 119L252 187Z"
                fill={`url(#${id}-wood)`}
                stroke="#cead76"
                strokeWidth="3"
              />
              <path
                d="M85 137Q159 118 239 137M78 158Q160 142 245 157"
                fill="none"
                stroke="#332733"
                strokeWidth="2"
              />
              <path
                d="M106 114L98 184M212 113L222 184"
                stroke={`url(#${id}-brass)`}
                strokeWidth="15"
              />
              <path
                d="M74 187L90 208L98 188L112 211L121 189L136 215L148 190L161 215L174 190L188 214L201 188L216 210L226 187L241 203L250 187"
                fill="#f5e6bf"
                stroke="#ad9c7a"
              />
              <path
                d="M124 141Q136 126 151 141Q137 161 124 141ZM169 141Q184 126 199 141Q184 161 169 141Z"
                fill="#d5de92"
                stroke="#342e2a"
                strokeWidth="3"
              />
              <path
                d="M139 136V148M184 136V148"
                stroke="#273b32"
                strokeWidth="4"
              />
              <path d="M153 163H173V185H153Z" fill={`url(#${id}-brass)`} />
              <circle cx="163" cy="173" r="3" fill="#362c2c" />
            </g>
          </g>
        </g>
      </svg>
      {plan && !reducedMotion && (
        <svg
          className={tongueStyles.tongueCanvas}
          focusable="false"
          style={{ visibility: ended ? 'hidden' : undefined }}
        >
          <defs>
            <linearGradient id={`${id}-tongue`} x1="0" y1="0" x2="0.15" y2="1">
              <stop stopColor="#692c42" />
              <stop offset="0.27" stopColor="#bc697d" />
              <stop offset="0.48" stopColor="#e6a0ac" />
              <stop offset="0.7" stopColor="#c97788" />
              <stop offset="1" stopColor="#793849" />
            </linearGradient>
            <linearGradient id={`${id}-wrap`} x1="0" y1="0" x2="1" y2="0.25">
              <stop stopColor="#612b40" />
              <stop offset="0.3" stopColor="#b56377" />
              <stop offset="0.55" stopColor="#e4a3ae" />
              <stop offset="0.75" stopColor="#c37788" />
              <stop offset="1" stopColor="#803c51" />
            </linearGradient>
          </defs>
          <g
            transform={`translate(${plan.mouth.x} ${plan.mouth.y}) rotate(${plan.angle})`}
          >
            <g
              ref={tongueRef}
              className={tongueStyles.tongue}
              data-mimic-tongue="true"
              data-tip-x={plan.length}
            >
              <path
                d={`M0 -14 C${plan.length * 0.3} ${-Math.min(60, plan.length * 0.15) - 12} ${plan.length * 0.7} -22 ${plan.length} -5 Q${plan.length + 8} 0 ${plan.length} 6 C${plan.length * 0.67} 0 ${plan.length * 0.3} ${-Math.min(60, plan.length * 0.15) + 12} 0 14Z`}
                fill={`url(#${id}-tongue)`}
                stroke="#6c3448"
                strokeWidth="1.4"
              />
              <path
                d={`M4 -4 C${plan.length * 0.3} ${-Math.min(60, plan.length * 0.15)} ${plan.length * 0.68} -11 ${plan.length - 4} 0`}
                fill="none"
                stroke="#f5bdc3"
                strokeWidth="2.5"
                opacity="0.6"
              />
            </g>
          </g>
          <g
            ref={loopRef}
            className={tongueStyles.loop}
            data-mimic-grip="true"
            style={{ transformOrigin: `${plan.grab.x}px ${plan.grab.y}px` }}
          >
            <g transform={`translate(${plan.grab.x} ${plan.grab.y})`}>
              <g data-mimic-wrap="front">
                <path
                  d={frontWrap}
                  pathLength="1"
                  stroke="#140c20"
                  strokeWidth="24"
                  opacity="0.28"
                  transform="translate(2 3)"
                />
                <path
                  d={frontWrap}
                  pathLength="1"
                  stroke="#713448"
                  strokeWidth="20"
                />
                <path
                  d={frontWrap}
                  pathLength="1"
                  stroke={`url(#${id}-wrap)`}
                  strokeWidth="17"
                />
                <path
                  d={frontWrap}
                  pathLength="1"
                  stroke="#f3bac0"
                  strokeWidth="2"
                  opacity="0.6"
                  transform="translate(-3 0)"
                />
                <path
                  d={curl}
                  pathLength="1"
                  stroke="#824054"
                  strokeWidth="10"
                />
                <path
                  d={curl}
                  pathLength="1"
                  stroke="#ce8999"
                  strokeWidth="6"
                />
              </g>
            </g>
          </g>
        </svg>
      )}
    </div>
  );
};
export default HalloweenMimic;
