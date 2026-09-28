import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { useCallback, useEffect, useRef, useState, type FC } from 'react';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { HalloweenScene } from '../../types/halloween';
import { animateFootprints } from '../../utils/halloween-footprint-animation';
import {
  buildFootprintPlan,
  FootprintSurface,
  FootprintPart,
  type FootprintPlan,
} from '../../utils/halloween-footprint-plan';
import { getFootprintTargets } from '../../utils/halloween-footprint-targets';
import styles from './HalloweenFootprints.module.scss';

/** An invisible familiar weighs on a card or input outline, then jumps away. */
const HalloweenFootprints: FC = () => {
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
      typeof Element.prototype.animate === 'function' &&
      typeof ResizeObserver === 'function',
  );
  const [plan, setPlan] = useState<FootprintPlan | null>(null);
  const [ended, setEnded] = useState(false);
  const stopped = useRef(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const copiesRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const printsRef = useRef<(SVGSVGElement | null)[]>([]);
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
      setPlan(buildFootprintPlan(getFootprintTargets(anchors), isMobile));
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
    if (
      ended ||
      changed ||
      stopped.current ||
      reducedMotion ||
      !supportsMotion ||
      !plan ||
      !hostRef.current ||
      !copiesRef.current ||
      !faceRef.current
    )
      return;
    let disposed = false;
    const stop = animateFootprints(
      plan,
      {
        host: hostRef.current,
        copies: copiesRef.current,
        prints: printsRef.current.filter(
          (node): node is SVGSVGElement => !!node,
        ),
        surface: surfaceRef.current,
        face: faceRef.current,
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
  const prop = plan?.card ?? plan?.ledge;
  const printArt = (surface: FootprintSurface) =>
    plan?.prints.map((print, index) =>
      print.surface === surface ? (
        <svg
          key={index}
          ref={(node) => {
            printsRef.current[index] = node;
          }}
          viewBox="0 0 40 44"
          aria-hidden="true"
          focusable="false"
          className={mergeClasses(styles.paw, 'absolute opacity-0')}
          data-footprint={index}
          style={{
            left: print.point.x - plan.size / 2,
            right: 'auto',
            top: print.point.y - (plan.size * 44) / 80,
            width: plan.size,
            height: (plan.size * 44) / 40,
            transformOrigin: '50% 50%',
          }}
        >
          <Paw />
        </svg>
      ) : null,
    );
  return (
    <div
      ref={hostRef}
      className={mergeClasses(
        styles.scene,
        'pointer-events-none absolute inset-0 select-none overflow-clip',
      )}
      aria-hidden="true"
      inert
      data-halloween-scene={HalloweenScene.Footprints}
      data-ready={stationary || !!plan}
      data-ended={ended || changed}
      data-stationary={stationary}
    >
      <div ref={copiesRef} className="absolute inset-0 z-[1]" />
      {stationary ? (
        <div
          className="absolute inset-x-0 top-1/3 flex items-center justify-center gap-3"
          data-footprint-static
        >
          {[0, 1, 2].map((index) => (
            <svg
              key={index}
              viewBox="0 0 40 44"
              focusable="false"
              className={mergeClasses(styles.paw, 'w-6')}
              style={{
                transform: `rotate(75deg) scaleX(${index % 2 ? -1 : 1})`,
              }}
            >
              <Paw />
            </svg>
          ))}
          <Face />
        </div>
      ) : (
        <>
          <div className="absolute inset-0 z-[2]">
            {printArt(FootprintSurface.Page)}
          </div>
          {prop && !ended && !changed && (
            <div
              ref={surfaceRef}
              className="absolute z-[2] opacity-0"
              data-footprint-surface
              style={{
                left: prop.rect.left,
                right: 'auto',
                top: prop.rect.top,
                width: prop.rect.width,
                height: prop.rect.height,
                transformOrigin: '50% 100%',
              }}
            >
              {plan?.ledge && (
                <div
                  data-footprint-ledge
                  className={mergeClasses(
                    styles.ledge,
                    'absolute inset-0 border-2',
                  )}
                  style={{ borderRadius: plan.ledge.borderRadius }}
                />
              )}
              {printArt(
                plan?.ledge ? FootprintSurface.Composer : FootprintSurface.Card,
              )}
            </div>
          )}
          <div
            ref={faceRef}
            className="absolute top-0 z-[3] size-0 opacity-0"
            data-footprint-face
            style={{ left: 0, right: 'auto', transformOrigin: '0 0' }}
          >
            <div
              className="absolute top-0"
              style={{ left: -50, right: 'auto' }}
            >
              <Face />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* Six shapes keep asymmetric toe pads and their compressed weight readable at 23px. */
const Paw: FC = () => (
  <>
    <path d="M11 26C13 23 14 20 18 21C22 18 26 22 28 26C30 29 35 33 31 37C28 40 24 36 21 37C17 41 13 37 10 38C4 36 8 29 11 26Z" />
    <ellipse cx="7.5" cy="20" rx="4" ry="5.4" transform="rotate(-32 7.5 20)" />
    <ellipse cx="15" cy="11" rx="4.4" ry="6.1" transform="rotate(-9 15 11)" />
    <ellipse cx="25" cy="10" rx="4.2" ry="6.5" transform="rotate(12 25 10)" />
    <ellipse cx="33" cy="19" rx="3.7" ry="5.2" transform="rotate(34 33 19)" />
    <path
      className={styles.padLight}
      d="M11 30Q14 24 17 25M14 8L13 11M24 6L23 10M6 18L5 20"
    />
  </>
);

const Face: FC = () => (
  <svg
    viewBox="0 0 100 61"
    className="w-[100px]"
    aria-hidden="true"
    focusable="false"
  >
    <g data-footprint-part={FootprintPart.Eyes}>
      <path
        className={styles.eye}
        d="M9 18Q25 5 42 20Q24 32 9 18ZM58 20Q76 4 91 17Q77 31 58 20Z"
      />
      <g data-footprint-part={FootprintPart.Gaze}>
        <path
          className={styles.pupil}
          d="M25 12Q21 20 26 26Q29 20 25 12ZM75 11Q72 19 76 25Q79 18 75 11Z"
        />
        <path className={styles.eyeLight} d="M21 15L22 17M71 14L72 16" />
      </g>
      <path className={styles.lid} d="M9 18Q24 4 42 20M58 20Q76 3 91 17" />
    </g>
    <g data-footprint-part={FootprintPart.Grin}>
      <path
        className={styles.mouth}
        d="M17 37Q49 52 84 35Q75 58 52 58Q30 58 17 37Z"
      />
      <path
        className={styles.teeth}
        d="M22 40Q51 61 80 39M34 45L37 53M47 48L48 57M61 47L60 56M73 42L70 51"
      />
      <path className={styles.smile} d="M13 38Q16 39 19 35M82 34Q83 38 87 36" />
    </g>
  </svg>
);

export default HalloweenFootprints;
