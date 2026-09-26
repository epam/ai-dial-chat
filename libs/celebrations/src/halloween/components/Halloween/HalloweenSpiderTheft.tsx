import { useEffect, useRef, useState, type FC } from 'react';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { HalloweenScene } from '../../types/halloween';
import { buildHalloweenSpiderDrop } from '../../utils/halloween';
import {
  animateSpiderTheft,
  buildSpiderTheftPlans,
  getSpiderTheftTargets,
  type SpiderTheftActor,
  type SpiderTheftPlan,
} from '../../utils/halloween-spider-theft';
import fallbackStyles from './Halloween.module.scss';
import HalloweenSpider from './HalloweenSpider';
import styles from './HalloweenSpiderTheft.module.scss';

/** A shallow silk sling joins curved support fibres at their actual weave points. */
const SpiderSilk: FC<{ plan: SpiderTheftPlan }> = ({ plan }) => {
  if (!plan.target) return null;
  const { left, top, width, height } = plan.target.rect;
  const root = { x: plan.x, y: plan.depth - 2 };
  const supports = [
    [0.02, 0.32],
    [0.08, 0.85],
    [0.33, 1.03],
    [0.63, 0.96],
    [0.9, 0.9],
    [0.98, 0.21],
  ].map(([x, y], index) => {
    const end = { x: left + width * x, y: top + height * y };
    return {
      end,
      control: {
        x: root.x + (end.x - root.x) * 0.57 + (index % 2 ? 1.5 : -1.5),
        y: root.y + (end.y - root.y) * 0.38,
      },
    };
  });
  const strands: { d: string; width: number; opacity: number }[] = [];

  for (const [index, { control, end }] of supports.entries()) {
    strands.push({
      d: `M${root.x} ${root.y}Q${control.x} ${control.y} ${end.x} ${end.y}`,
      width: index % 2 ? 0.6 : 0.8,
      opacity: index % 2 ? 0.38 : 0.56,
    });
  }

  /* Every scallop ends on a support fibre, with a slight sag between knots. */
  for (const [row, distance] of [0.28, 0.52, 0.76, 0.97].entries()) {
    const knots = supports.map(({ control, end }, index) => {
      const t = distance + Math.sin(index * 1.7 + row * 2.1) * 0.02;
      const rest = 1 - t;
      return {
        x: rest * rest * root.x + 2 * rest * t * control.x + t * t * end.x,
        y: rest * rest * root.y + 2 * rest * t * control.y + t * t * end.y,
      };
    });
    let path = `M${knots[0].x} ${knots[0].y}`;
    for (let index = 1; index < knots.length; index++) {
      const previous = knots[index - 1];
      const current = knots[index];
      const sag = Math.min(7, height * 0.08 + row * 0.4 + (index % 2) * 0.8);
      path += `Q${(previous.x + current.x) / 2} ${(previous.y + current.y) / 2 + sag} ${current.x} ${current.y}`;
    }
    strands.push({
      d: path,
      width: row % 2 ? 0.55 : 0.65,
      opacity: row % 2 ? 0.3 : 0.42,
    });
  }

  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {strands.map((strand, index) => (
        <path
          key={index}
          className={styles.silk}
          data-silk-strand={index}
          pathLength="1"
          d={strand.d}
          strokeWidth={strand.width}
          strokeOpacity={strand.opacity}
        />
      ))}
    </g>
  );
};

/** Small thieves descend on silk and climb back with bits of the welcome screen. */
const HalloweenSpiderTheft: FC = () => {
  const reducedMotion = useReducedMotion();
  const { anchors } = useCelebrationEnvironment();
  const [drops] = useState(buildHalloweenSpiderDrop);
  const [plans, setPlans] = useState<SpiderTheftPlan[] | null>(null);
  const [ended, setEnded] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const carrierRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cargoRefs = useRef<(HTMLDivElement | null)[]>([]);
  const webRefs = useRef<(SVGSVGElement | null)[]>([]);
  useEffect(() => {
    setPlans(null);
    if (reducedMotion || typeof hostRef.current?.animate !== 'function') return;
    let disposed = false;
    const prepare = async () => {
      /* Measure after this commit: a disposed StrictMode rehearsal or an
         early interaction must never read layout. */
      await Promise.resolve();
      if (disposed) return;
      /* Without borrowable targets the decorative drop stays available. */
      const targets = getSpiderTheftTargets(anchors);
      if (!targets.length) return;
      const viewport = document.documentElement;
      setPlans(
        buildSpiderTheftPlans(
          targets,
          drops,
          viewport.clientWidth,
          viewport.clientHeight,
        ),
      );
    };
    prepare();
    return () => {
      disposed = true;
    };
  }, [anchors, reducedMotion, drops]);
  useEffect(() => {
    setEnded(false);
    if (!plans || reducedMotion || !hostRef.current) return;
    const actors: SpiderTheftActor[] = [];
    for (let index = 0; index < plans.length; index++) {
      const carrier = carrierRefs.current[index];
      const cargo = cargoRefs.current[index];
      if (!carrier || !cargo) return;
      actors.push({ carrier, cargo, web: webRefs.current[index] });
    }
    return animateSpiderTheft(plans, actors, hostRef.current, () =>
      setEnded(true),
    );
  }, [plans, reducedMotion]);
  return (
    <div
      ref={hostRef}
      className={styles.scene}
      data-halloween-scene={HalloweenScene.Spiders}
      aria-hidden="true"
    >
      {!plans || reducedMotion
        ? drops.map((spider, index) => (
            <span
              key={index}
              className={fallbackStyles.spiderDrop}
              style={spider.style}
            >
              <span className={fallbackStyles.spiderSwing}>
                <span
                  className={`${fallbackStyles.spiderThread} bg-control-neutral-default`}
                />
                <HalloweenSpider className={fallbackStyles.spiderBody} />
              </span>
            </span>
          ))
        : plans.map((plan, index) => (
            <div
              key={index}
              ref={(node) => {
                carrierRefs.current[index] = node;
              }}
              className={styles.carrier}
              data-spider-carrier={index}
              style={{ visibility: ended ? 'hidden' : undefined }}
            >
              <span
                className={styles.thread}
                style={{
                  left: plan.x,
                  height: Math.max(0, plan.depth - plan.size),
                }}
              />
              <div
                className={styles.spider}
                style={{
                  left: plan.x - (plan.size * 64) / 120,
                  top: plan.depth - plan.size,
                  width: (plan.size * 64) / 60,
                  height: plan.size,
                }}
              >
                <HalloweenSpider className={styles.body} />
              </div>
              <div
                ref={(node) => {
                  cargoRefs.current[index] = node;
                }}
                className={styles.cargo}
              />
              {plan.target && (
                <svg
                  ref={(node) => {
                    webRefs.current[index] = node;
                  }}
                  className={styles.web}
                  focusable="false"
                >
                  <SpiderSilk plan={plan} />
                </svg>
              )}
            </div>
          ))}
    </div>
  );
};
export default HalloweenSpiderTheft;
