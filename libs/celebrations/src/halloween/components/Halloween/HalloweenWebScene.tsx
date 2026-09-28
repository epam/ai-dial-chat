import { memo, useEffect, useRef, type FC } from 'react';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { animateHalloweenWeb } from '../../utils/halloween-web-animation';
import {
  buildHalloweenWebPlan,
  type HalloweenWebPlan,
} from '../../utils/halloween-web-plan';
import { getHalloweenWebTargets } from '../../utils/halloween-web-targets';
import styles from './HalloweenWebScene.module.scss';

/** Decorative silk attaches to measured UI edges without changing the page underneath. */
const HalloweenWebScene: FC = () => {
  const { isMobile, anchors } = useCelebrationEnvironment();
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const planRef = useRef<{
    isMobile: boolean;
    targetsKey: string;
    plan: HalloweenWebPlan;
  } | null>(null);
  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    const prepare = async () => {
      /* Measure after this commit: a disposed StrictMode rehearsal or an
         early interaction must never read layout. */
      await Promise.resolve();
      if (disposed) return;
      /* Without anchors the random connected mesh remains available. */
      const targets = getHalloweenWebTargets(anchors);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { clientWidth: width, clientHeight: height } =
        document.documentElement;
      const targetsKey = JSON.stringify(targets);
      if (
        !planRef.current ||
        planRef.current.isMobile !== isMobile ||
        planRef.current.targetsKey !== targetsKey ||
        planRef.current.plan.width !== width ||
        planRef.current.plan.height !== height
      ) {
        planRef.current = {
          isMobile,
          targetsKey,
          plan: buildHalloweenWebPlan({ width, height, isMobile, targets }),
        };
      }
      stop = animateHalloweenWeb(canvas, planRef.current.plan, {
        reducedMotion,
        color: getComputedStyle(canvas).color,
        pixelRatio: window.devicePixelRatio,
      });
    };
    prepare();
    return () => {
      disposed = true;
      stop?.();
    };
  }, [anchors, isMobile, reducedMotion]);
  return (
    <canvas
      ref={canvasRef}
      className={styles.scene}
      aria-hidden="true"
      data-halloween-scene="web"
    />
  );
};

export default memo(HalloweenWebScene);
