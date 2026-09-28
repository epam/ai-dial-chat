import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { useCallback, useEffect, useRef, useState, type FC } from 'react';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { HalloweenScene } from '../../types/halloween';
import { animateWitches } from '../../utils/halloween-witch-animation';
import {
  buildWitchPlan,
  type WitchPlan,
} from '../../utils/halloween-witch-plan';
import { getWitchTargets } from '../../utils/halloween-witch-targets';
import HalloweenWitch, { HalloweenFrogFeatures } from './HalloweenWitch';
import styles from './HalloweenWitches.module.scss';

/** Two witches teach a finite spell lesson without touching application state. */
const HalloweenWitches: FC = () => {
  const { isMobile, anchors } = useCelebrationEnvironment();
  const reducedMotion = useReducedMotion();
  const [initial] = useState(() => ({ isMobile, reducedMotion, anchors }));
  const changed =
    initial.isMobile !== isMobile ||
    initial.reducedMotion !== reducedMotion ||
    initial.anchors !== anchors;
  const [supportsMotion] = useState(
    () =>
      typeof Element !== 'undefined' &&
      typeof Element.prototype.animate === 'function',
  );
  const [plan, setPlan] = useState<WitchPlan | null>(null);
  const [ended, setEnded] = useState(false);
  const stopped = useRef(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const copiesRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);
  const actorsRef = useRef<(HTMLDivElement | null)[]>([]);
  const spellsRef = useRef<(SVGSVGElement | null)[]>([]);
  const stopScene = useCallback(() => {
    stopped.current = true;
    setEnded(true);
  }, []);
  useEffect(() => {
    if (changed) stopScene();
  }, [changed, stopScene]);
  useEffect(() => {
    if (ended || changed || stopped.current || reducedMotion || !supportsMotion)
      return;
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
      if (event.type === 'visibilitychange' && !document.hidden) return;
      cancel();
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
      'visibilitychange',
    ];
    events.forEach((event) => window.addEventListener(event, interrupt, true));
    const prepare = async () => {
      await Promise.resolve();
      if (disposed || stopped.current) return;
      setPlan(buildWitchPlan(getWitchTargets(anchors, isMobile), isMobile));
    };
    prepare();
    return () => {
      disposed = true;
      events.forEach((event) =>
        window.removeEventListener(event, interrupt, true),
      );
    };
  }, [
    anchors,
    changed,
    ended,
    isMobile,
    reducedMotion,
    stopScene,
    supportsMotion,
  ]);
  useEffect(() => {
    const frog = templateRef.current?.querySelector('svg');
    if (
      ended ||
      changed ||
      stopped.current ||
      reducedMotion ||
      !supportsMotion ||
      !plan ||
      !hostRef.current ||
      !copiesRef.current ||
      !frog
    )
      return;
    let disposed = false;
    const stop = animateWitches(
      plan,
      {
        host: hostRef.current,
        copies: copiesRef.current,
        actors: actorsRef.current.filter(
          (node): node is HTMLDivElement => !!node,
        ),
        spells: spellsRef.current.filter(
          (node): node is SVGSVGElement => !!node,
        ),
        frog,
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
      className={mergeClasses(
        styles.scene,
        'pointer-events-none absolute inset-0 select-none overflow-clip',
      )}
      aria-hidden="true"
      inert
      data-halloween-scene={HalloweenScene.Witches}
      data-ready={stationary || !!plan}
      data-ended={ended || changed}
      data-stationary={stationary}
    >
      <div ref={copiesRef} className="absolute inset-0 z-[2]" />
      {!stationary && (
        <div ref={templateRef} className="hidden">
          <HalloweenFrogFeatures />
        </div>
      )}
      {stationary ? (
        <div
          className="absolute inset-x-0 top-1/3 flex justify-center gap-3"
          data-witch-static
        >
          <div className="w-28 desktop:w-36">
            <HalloweenWitch />
          </div>
          <div className="w-28 -scale-x-100 desktop:w-36">
            <HalloweenWitch mentor />
          </div>
        </div>
      ) : (
        plan?.actors.map((actor, index) => (
          <div
            key={index}
            ref={(node) => {
              actorsRef.current[index] = node;
            }}
            className="absolute top-0 z-[3] size-0 opacity-0"
            data-witch-actor={index}
            style={{
              left: 0,
              right: 'auto',
              transformOrigin: '0 0',
              transform: `translate(${actor.rest.x}px, ${actor.rest.y}px)`,
            }}
          >
            <div
              className="absolute top-0"
              style={{
                left: 0,
                right: 'auto',
                width: actor.size,
                height: (actor.size * 150) / 180,
                transform: 'translate(-50%, -80%)',
              }}
            >
              <div
                className="size-full"
                style={{ transform: `scaleX(${actor.facing})` }}
              >
                <HalloweenWitch mentor={actor.mentor} />
              </div>
            </div>
          </div>
        ))
      )}
      {!stationary &&
        plan?.spells.map((spell, index) => (
          <svg
            key={index}
            ref={(node) => {
              spellsRef.current[index] = node;
            }}
            viewBox="-10 -10 20 20"
            aria-hidden="true"
            focusable="false"
            className={mergeClasses(
              'absolute -top-2.5 z-[4] size-5 opacity-0',
              spell.mentor ? styles.mentorSpell : styles.spell,
            )}
            style={{ left: -10, right: 'auto' }}
            data-witch-spell
          >
            <path d="M0-9L2-2L9 0L2 2L0 9L-2 2L-9 0L-2-2Z" />
          </svg>
        ))}
    </div>
  );
};

export default HalloweenWitches;
