import { useCallback, useEffect, useRef, useState, type FC } from 'react';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useReducedMotion } from '../../hooks/celebration/useReducedMotion';
import { HalloweenBurst } from '../../types/halloween';
import { animateBats } from '../../utils/halloween-bat-animation';
import { buildBatPlan, type BatPlan } from '../../utils/halloween-bat-plan';
import { getBatTargets } from '../../utils/halloween-bat-targets';
import HalloweenBat from './HalloweenBat';
import styles from './HalloweenBats.module.scss';
import HalloweenNightFlight from './HalloweenNightFlight';

/** A sleepy bat and two overenthusiastic helpers, entirely in the decoration layer. */
const HalloweenBats: FC = () => {
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
  const [plan, setPlan] = useState<BatPlan | null>(null);
  const [ended, setEnded] = useState(false);
  const stopped = useRef(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const copiesRef = useRef<HTMLDivElement>(null);
  const actorRefs = useRef<(HTMLDivElement | null)[]>([]);
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
    /* Deferred public-class imports must not let a cancelled scene start later. */
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
      const composerClass =
        composer.status === 'fulfilled'
          ? composer.value.CONVERSATION_INPUT_CLASS.wrapper
          : '';
      const starterListClass =
        starters.status === 'fulfilled'
          ? starters.value.STARTER_BUTTONS_CLASS.list
          : undefined;
      setPlan(
        buildBatPlan(
          getBatTargets(composerClass, starterListClass, isMobile ? 3 : 5),
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
      !copiesRef.current
    )
      return;
    let disposed = false;
    const stop = animateBats(
      plan,
      {
        host: hostRef.current,
        copies: copiesRef.current,
        actors: actorRefs.current.filter(
          (actor): actor is HTMLDivElement => !!actor,
        ),
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
      data-halloween-scene={HalloweenBurst.Bats}
      data-ready={stationary || !!plan}
      data-ended={ended || changed}
      data-stationary={stationary}
    >
      <div ref={copiesRef} className={styles.copies} />
      {!stationary && plan?.active
        ? plan.actors.map((actor, index) => (
            <div
              key={index}
              ref={(node) => {
                actorRefs.current[index] = node;
              }}
              className={styles.actor}
              data-bat-actor={index}
              data-bat-sleeper={actor.sleeper}
              style={{
                transform: `translate(${actor.rest.x}px, ${actor.rest.y}px)`,
              }}
            >
              <div
                className={styles.art}
                style={{ width: actor.size, height: actor.size * 0.8 }}
              >
                <HalloweenBat sleeper={actor.sleeper} />
              </div>
            </div>
          ))
        : (stationary || plan) && (
            <div className={styles.fallback} data-bat-fallback="true">
              <HalloweenNightFlight burst={HalloweenBurst.Bats} />
            </div>
          )}
    </div>
  );
};

export default HalloweenBats;
