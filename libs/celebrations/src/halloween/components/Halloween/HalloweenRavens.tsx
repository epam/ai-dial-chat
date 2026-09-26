import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FC,
} from 'react';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { HalloweenScene } from '../../types/halloween';
import { animateRavens } from '../../utils/halloween-raven-animation';
import {
  buildRavenPlan,
  type RavenPlan,
} from '../../utils/halloween-raven-plan';
import {
  RAVEN_FRAGMENT_CLIP,
  getRavenTargets,
} from '../../utils/halloween-raven-targets';
import HalloweenRaven from './HalloweenRaven';
import styles from './HalloweenRavens.module.scss';

const TWIG_COUNT = 22;

/** A finite nest-building story; all real controls remain owned by their original components. */
const HalloweenRavens: FC = () => {
  const { isMobile, anchors } = useCelebrationEnvironment();
  const initialMobile = useRef(isMobile);
  const reducedMotion = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const copiesRef = useRef<HTMLDivElement>(null);
  const nestRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const birdRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [prepared, setPrepared] = useState<{
    plan: RavenPlan;
    isMobile: boolean;
    reducedMotion: boolean;
  } | null>(null);
  const plan =
    prepared?.isMobile === isMobile && prepared.reducedMotion === reducedMotion
      ? prepared.plan
      : null;
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    if (isMobile !== initialMobile.current) setEnded(true);
  }, [isMobile]);
  useEffect(() => {
    let disposed = false;
    const prepare = async () => {
      /* Measure after this commit: a disposed StrictMode rehearsal or an
         early interaction must never read layout. */
      await Promise.resolve();
      /* History and pumpkin anchors still work for hosts without a composer. */
      if (!disposed)
        setPrepared({
          plan: buildRavenPlan(getRavenTargets(anchors), isMobile),
          isMobile,
          reducedMotion,
        });
    };
    prepare();
    return () => {
      disposed = true;
    };
  }, [anchors, isMobile, reducedMotion]);
  useEffect(() => {
    if (
      ended ||
      !plan ||
      reducedMotion ||
      !hostRef.current ||
      !copiesRef.current ||
      !nestRef.current
    )
      return;
    let disposed = false;
    const stop = animateRavens(
      plan,
      {
        host: hostRef.current,
        copies: copiesRef.current,
        nest: nestRef.current,
        fallback: fallbackRef.current,
        birds: birdRefs.current.filter(
          (bird): bird is HTMLDivElement => !!bird,
        ),
      },
      () => {
        if (!disposed) setEnded(true);
      },
    );
    return () => {
      disposed = true;
      stop();
    };
  }, [ended, plan, reducedMotion]);
  const count = isMobile ? 5 : 8;
  return (
    <div
      ref={hostRef}
      className={styles.scene}
      aria-hidden="true"
      data-halloween-scene={HalloweenScene.Ravens}
      data-ready={!!plan}
      data-animated={
        !reducedMotion &&
        plan?.active &&
        typeof Element !== 'undefined' &&
        typeof Element.prototype.animate === 'function'
      }
      style={{ visibility: ended && !reducedMotion ? 'hidden' : undefined }}
    >
      {plan?.materials.map((material, index) => (
        <span
          key={index}
          className={styles.edgeGap}
          data-raven-edge-gap={index}
          style={{
            left: material.x,
            top: material.y,
            width: material.width,
            height: material.height,
            clipPath: material.fragment ? RAVEN_FRAGMENT_CLIP : undefined,
            background: material.background,
          }}
        />
      ))}
      <div ref={copiesRef} className={styles.copies} />
      <div ref={fallbackRef} className={styles.fallback} inert />
      <div
        ref={nestRef}
        className={styles.nest}
        data-raven-nest="true"
        style={
          {
            left: plan?.nest.x ?? 0,
            top: plan?.nest.y ?? 0,
            '--nest-width': `${plan?.nestWidth ?? 92}px`,
            transformOrigin: plan?.pumpkin
              ? `${plan.pumpkin.rect.left + plan.pumpkin.rect.width / 2 - plan.nest.x}px ${plan.pumpkin.rect.top + plan.pumpkin.rect.height / 2 - plan.nest.y}px`
              : undefined,
          } as CSSProperties
        }
      >
        <svg viewBox="0 0 120 58" focusable="false" aria-hidden="true">
          {Array.from({ length: TWIG_COUNT }, (_, index) => {
            const row = Math.floor(index / 2);
            const left = 8 + ((index * 13) % 21);
            const right = 96 + ((index * 7) % 18);
            const y = 17 + row * 2.1;
            return (
              <path
                key={index}
                data-raven-twig={index}
                d={`M${left} ${y - 8} Q60 ${y + 21} ${right} ${y - 5} M${left + 13} ${y + 1} l-7 -9 M${right - 19} ${y + 2} l9 -10`}
                fill="none"
                stroke={
                  index % 3 === 0
                    ? '#b7a3cd'
                    : index % 3 === 1
                      ? '#8b6545'
                      : '#c49663'
                }
                strokeWidth={index % 3 === 0 ? 2.1 : 1.6}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      </div>
      {Array.from({ length: count }, (_, index) => {
        const bird = plan?.birds[index];
        return (
          <div
            key={index}
            ref={(node) => {
              birdRefs.current[index] = node;
            }}
            className={styles.bird}
            data-raven-bird={index}
            style={
              {
                '--raven-size': `${bird?.size ?? 56}px`,
                '--raven-facing': bird?.facing ?? 1,
                transform: bird
                  ? `translate(${bird.perch.x}px, ${bird.perch.y}px)`
                  : undefined,
              } as CSSProperties
            }
          >
            <div className={styles.art} data-raven-orientation="true">
              <HalloweenRaven />
            </div>
            <div data-raven-fragment-slot="true" inert />
            {bird?.material !== undefined &&
              plan?.materials[bird.material] &&
              !plan.materials[bird.material].fragment && (
                <svg
                  className={styles.ribbon}
                  style={{ transform: `scaleX(${bird.facing})` }}
                  data-raven-carried-strip="true"
                  width={plan.materials[bird.material].width}
                  height="28"
                  viewBox="0 0 78 28"
                  preserveAspectRatio="none"
                  focusable="false"
                >
                  <path
                    d="M0 0Q27 25 48 11T78 0"
                    fill="none"
                    stroke={plan.materials[bird.material].color}
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M0 0Q27 25 48 11T78 0"
                    fill="none"
                    stroke="#e4c7ff"
                    strokeWidth="0.6"
                    strokeLinecap="round"
                  />
                </svg>
              )}
          </div>
        );
      })}
    </div>
  );
};

export default HalloweenRavens;
