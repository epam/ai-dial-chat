import { useCallback, useEffect, useRef, useState, type FC } from 'react';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useReducedMotion } from '../../hooks/celebration/useReducedMotion';
import { HalloweenBurst } from '../../types/halloween';
import { animateCat } from '../../utils/halloween-cat-animation';
import { buildCatPlan, type CatPlan } from '../../utils/halloween-cat-plan';
import { getCatTargets } from '../../utils/halloween-cat-targets';
import HalloweenCat from './HalloweenCat';
import styles from './HalloweenCatScene.module.scss';

/** A curious cat tests gravity using reversible copies of nearby controls. */
const HalloweenCatScene: FC = () => {
  const isMobile = useIsMobile();
  const reducedMotion = useReducedMotion();
  const [initial] = useState(() => ({ isMobile, reducedMotion }));
  const changed =
    initial.isMobile !== isMobile || initial.reducedMotion !== reducedMotion;
  const [supportsMotion] = useState(
    () =>
      typeof Element !== 'undefined' &&
      typeof Element.prototype.animate === 'function',
  );
  const [plan, setPlan] = useState<CatPlan | null>(null);
  const [ended, setEnded] = useState(false);
  const stopped = useRef(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const copiesRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<HTMLDivElement>(null);
  const facingRef = useRef<HTMLDivElement>(null);
  const stopScene = useCallback(() => {
    stopped.current = true;
    setEnded(true);
  }, []);

  useEffect(() => {
    if (changed) stopScene();
  }, [changed, stopScene]);

  useEffect(() => {
    if (changed || stopped.current || reducedMotion || !supportsMotion) return;
    let disposed = false;
    const cancel = () => {
      disposed = true;
      stopScene();
    };
    const interrupt = (event: Event) => {
      if (
        event.type === 'scroll' &&
        event.target instanceof Node &&
        hostRef.current?.contains(event.target)
      )
        return;
      cancel();
    };
    const handleVisibility = () => {
      if (document.hidden) cancel();
    };
    const events = [
      'pointerdown',
      'keydown',
      'focusin',
      'beforeinput',
      'input',
      'compositionstart',
      'scroll',
      'resize',
    ];
    events.forEach((event) => window.addEventListener(event, interrupt, true));
    document.addEventListener('visibilitychange', handleVisibility);
    const prepare = async () => {
      const [composer, starters] = await Promise.allSettled([
        import('@epam/ai-dial-conversation-input'),
        import('@epam/ai-dial-starter-buttons'),
      ]);
      if (disposed || stopped.current) return;
      setPlan(
        buildCatPlan(
          getCatTargets(
            composer.status === 'fulfilled'
              ? composer.value.CONVERSATION_INPUT_CLASS.wrapper
              : '',
            starters.status === 'fulfilled'
              ? starters.value.STARTER_BUTTONS_CLASS.list
              : undefined,
          ),
          isMobile,
        ),
      );
    };
    prepare();
    return () => {
      disposed = true;
      events.forEach((event) =>
        window.removeEventListener(event, interrupt, true),
      );
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [changed, isMobile, reducedMotion, stopScene, supportsMotion]);

  useEffect(() => {
    if (
      ended ||
      changed ||
      stopped.current ||
      reducedMotion ||
      !supportsMotion ||
      !plan?.active ||
      !hostRef.current ||
      !copiesRef.current ||
      !actorRef.current ||
      !facingRef.current
    )
      return;
    let disposed = false;
    const stop = animateCat(
      plan,
      {
        host: hostRef.current,
        copies: copiesRef.current,
        actor: actorRef.current,
        facing: facingRef.current,
      },
      () => {
        if (!disposed) stopScene();
      },
    );
    return () => {
      disposed = true;
      stop();
    };
  }, [changed, ended, plan, reducedMotion, stopScene, supportsMotion]);

  const stationary = reducedMotion || !supportsMotion;
  return (
    <div
      ref={hostRef}
      className={styles.scene}
      aria-hidden="true"
      inert
      data-halloween-scene={HalloweenBurst.Cat}
      data-ready={stationary || !!plan}
      data-ended={ended || changed}
      data-stationary={stationary}
    >
      <div ref={copiesRef} className={styles.copies} />
      {!stationary && plan?.active && plan.floor && (
        <div
          className={styles.floor}
          data-cat-floor
          style={{
            left: plan.floor.x,
            top: plan.floor.y,
            width: plan.floor.width,
          }}
        />
      )}
      {!stationary && plan?.active ? (
        <div
          ref={actorRef}
          className={styles.actor}
          data-cat-actor
          style={{ transform: `translate(${plan.rest.x}px, ${plan.rest.y}px)` }}
        >
          <div
            className={styles.art}
            style={{ width: plan.size, height: (plan.size * 140) / 160 }}
          >
            <div ref={facingRef} className={styles.facing}>
              <HalloweenCat />
            </div>
          </div>
        </div>
      ) : (
        (stationary || plan) && (
          <div className={styles.fallback} data-cat-fallback>
            <HalloweenCat />
          </div>
        )
      )}
    </div>
  );
};

export default HalloweenCatScene;
