import { useCallback, useEffect, useRef, useState, type FC } from 'react';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useReducedMotion } from '../../hooks/celebration/useReducedMotion';
import { HalloweenBurst } from '../../types/halloween';
import {
  buildHalloweenGhostFlight,
  loadHalloweenAnchorClasses,
} from '../../utils/halloween';
import { animateGhosts } from '../../utils/halloween-ghost-animation';
import {
  buildGhostPlan,
  type GhostPlan,
} from '../../utils/halloween-ghost-plan';
import { getGhostTargets } from '../../utils/halloween-ghost-targets';
import flightStyles from './Halloween.module.scss';
import HalloweenGhost from './HalloweenGhost';
import styles from './HalloweenGhosts.module.scss';

/** Possessed visual copies and one failed scare, owned entirely by the decoration layer. */
const HalloweenGhosts: FC = () => {
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
  const [flights] = useState(buildHalloweenGhostFlight);
  const [plan, setPlan] = useState<GhostPlan | null>(null);
  const [ended, setEnded] = useState(false);
  const stopped = useRef(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const copiesRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
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
    /* Cancel even during deferred class imports, before there are snapshots. */
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
      const { composer, starterList } = await loadHalloweenAnchorClasses();
      if (disposed || stopped.current) return;
      setPlan(
        buildGhostPlan(
          getGhostTargets(composer, starterList, isMobile ? 3 : 5),
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
    const stop = animateGhosts(
      plan,
      {
        host: hostRef.current,
        copies: copiesRef.current,
        actors: actorRefs.current.filter(
          (actor): actor is HTMLDivElement => !!actor,
        ),
        faceTemplate: faceRef.current,
        pumpkinGlow: glowRef.current,
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
  const pumpkin = plan?.pumpkin?.rect;
  return (
    <div
      ref={hostRef}
      className={styles.scene}
      aria-hidden="true"
      inert
      data-halloween-scene={HalloweenBurst.Ghost}
      data-ready={stationary || !!plan}
      data-ended={ended || changed}
      data-stationary={stationary}
    >
      <div ref={copiesRef} className={styles.copies} />
      <div className={styles.templates}>
        <div ref={faceRef} className={styles.possessedFace}>
          <span className={styles.eye}>
            <span data-ghost-pupil="true" />
          </span>
          <span className={styles.eye}>
            <span data-ghost-pupil="true" />
          </span>
        </div>
      </div>
      {pumpkin && (
        <div
          ref={glowRef}
          className={styles.pumpkinGlow}
          style={{
            left: pumpkin.left,
            top: pumpkin.top,
            width: pumpkin.width,
            height: pumpkin.height,
          }}
        />
      )}
      {!stationary && plan?.active
        ? plan.actors.map((actor, index) => (
            <div
              key={index}
              ref={(node) => {
                actorRefs.current[index] = node;
              }}
              className={styles.actor}
              data-ghost-actor={index}
              data-ghost-leader={actor.leader}
              style={{
                transform: `translate(${actor.rest.x}px, ${actor.rest.y}px)`,
              }}
            >
              <div
                className={styles.art}
                style={{ width: actor.size, height: (actor.size * 88) / 64 }}
              >
                <div className={styles.cloth} data-ghost-cloth="true">
                  <HalloweenGhost variant={actor.variant} expressive />
                </div>
              </div>
            </div>
          ))
        : (stationary || plan) &&
          flights.map((ghost, index) => (
            <span
              key={index}
              className={flightStyles.ghost}
              style={ghost.style}
              data-ghost-fallback="true"
            >
              <HalloweenGhost
                variant={ghost.variant}
                className={flightStyles.ghostBody}
              />
            </span>
          ))}
    </div>
  );
};

export default HalloweenGhosts;
