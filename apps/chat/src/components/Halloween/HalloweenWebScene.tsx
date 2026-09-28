import { memo, useEffect, useRef, type FC } from 'react';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useReducedMotion } from '../../hooks/celebration/useReducedMotion';
import { animateHalloweenWeb } from '../../utils/halloween-web-animation';
import {
  buildHalloweenWebPlan,
  type HalloweenWebPlan,
} from '../../utils/halloween-web-plan';
import { getHalloweenWebTargets } from '../../utils/halloween-web-targets';
import styles from './HalloweenWebScene.module.scss';

/** Decorative silk attaches to measured UI edges without changing the page underneath. */
const HalloweenWebScene: FC = () => {
  const isMobile = useIsMobile();
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
      let targets: ReturnType<typeof getHalloweenWebTargets> = [];
      try {
        const { CONVERSATION_INPUT_CLASS } =
          await import('@epam/ai-dial-conversation-input');
        if (disposed) return;
        targets = getHalloweenWebTargets(CONVERSATION_INPUT_CLASS);
      } catch {
        /* The random connected mesh remains available without a mounted composer. */
      }
      const canvas = canvasRef.current;
      if (disposed || !canvas) return;
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
  }, [isMobile, reducedMotion]);
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
