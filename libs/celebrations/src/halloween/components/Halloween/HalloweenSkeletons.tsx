import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { useCallback, useEffect, useRef, useState, type FC } from 'react';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { HalloweenScene } from '../../types/halloween';
import { animateSkeletons } from '../../utils/halloween-skeleton-animation';
import {
  buildSkeletonPlan,
  SKELETON_ART,
  type SkeletonPlan,
} from '../../utils/halloween-skeleton-plan';
import { getSkeletonTargets } from '../../utils/halloween-skeleton-targets';
import { SkeletonArt, SkeletonSkullArt } from './HalloweenSkeletonArt';
import styles from './HalloweenSkeletons.module.scss';

/** Two dancers on the composer edge lose, chase and restore a skull. */
const HalloweenSkeletons: FC = () => {
  const { anchors, isMobile } = useCelebrationEnvironment();
  const reduced = useReducedMotion();
  const [initial] = useState(() => ({ anchors, isMobile, reduced }));
  const changed =
    initial.anchors !== anchors ||
    initial.isMobile !== isMobile ||
    initial.reduced !== reduced;
  const [supported] = useState(
    () =>
      typeof Element !== 'undefined' &&
      typeof Element.prototype.animate === 'function' &&
      typeof ResizeObserver === 'function',
  );
  const [plan, setPlan] = useState<SkeletonPlan | null>(null);
  const [ended, setEnded] = useState(false);
  const stopped = useRef(false),
    host = useRef<HTMLDivElement>(null);
  const stop = useCallback(() => {
    stopped.current = true;
    setEnded(true);
  }, []);
  const stationary = reduced || !supported;
  useEffect(() => {
    if (changed) stop();
  }, [changed, stop]);
  useEffect(() => {
    if (stationary || ended || changed || stopped.current) return;
    let disposed = false;
    const cancel = (event: Event) => {
      if (event.type === 'visibilitychange' && !document.hidden) return;
      disposed = true;
      stop();
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
    events.forEach((name) => window.addEventListener(name, cancel, true));
    const prepare = async () => {
      await Promise.resolve();
      if (!disposed && !stopped.current)
        setPlan(buildSkeletonPlan(getSkeletonTargets(anchors), isMobile));
    };
    prepare();
    return () => {
      disposed = true;
      events.forEach((name) => window.removeEventListener(name, cancel, true));
    };
  }, [anchors, isMobile, stationary, changed, ended, stop]);
  useEffect(() => {
    if (
      !plan ||
      !host.current ||
      stationary ||
      changed ||
      ended ||
      stopped.current
    )
      return;
    let disposed = false;
    const cancel = animateSkeletons(plan, host.current, () => {
      if (!disposed) stop();
    });
    return () => {
      disposed = true;
      cancel();
    };
  }, [plan, stationary, changed, ended, stop]);
  const actor = (name: string, scale: number, partner: boolean) => (
    <div
      className="absolute top-0 opacity-0"
      data-skeleton-actor={name}
      style={{
        left: 0,
        right: 'auto',
        width: SKELETON_ART.width * scale,
        height: SKELETON_ART.height * scale,
      }}
    >
      <div className="size-full" data-skeleton-facing>
        <SkeletonArt partner={partner} />
      </div>
    </div>
  );
  return (
    <div
      ref={host}
      className="pointer-events-none absolute inset-0 select-none overflow-clip"
      aria-hidden="true"
      inert
      data-halloween-scene={HalloweenScene.Skeletons}
      data-ready={stationary || !!plan}
      data-ended={ended || changed}
      data-stationary={stationary}
      style={{
        visibility:
          ended || changed || (!stationary && !plan) ? 'hidden' : undefined,
        transform: plan?.targets.rtl ? 'scaleX(-1)' : undefined,
      }}
    >
      {stationary ? (
        <div
          className="absolute inset-x-0 bottom-2 flex items-end justify-center gap-1"
          data-skeleton-static
        >
          <div className="h-[122px] w-[72px]">
            <SkeletonArt headless />
          </div>
          <div className="mb-[66px] size-8">
            <SkeletonSkullArt />
          </div>
          <div className="h-[113px] w-[66px] -scale-x-100">
            <SkeletonArt partner />
          </div>
        </div>
      ) : (
        plan && (
          <>
            {plan.ledge && (
              <div
                className={mergeClasses(
                  styles.ledge,
                  'absolute border-2 opacity-0',
                )}
                data-skeleton-ledge
                style={{
                  left: plan.ledge.left,
                  right: 'auto',
                  top: plan.ledge.top,
                  width: plan.ledge.width,
                  height: plan.ledge.height,
                  borderRadius: plan.ledge.borderRadius,
                }}
              />
            )}
            {actor('showman', plan.showman.scale, false)}
            {actor('partner', plan.partner.scale, true)}
            {plan.word && (
              <div
                className="absolute top-0 whitespace-nowrap opacity-0"
                data-skeleton-word
                style={{
                  left: 0,
                  right: 'auto',
                  width: plan.word.width,
                  height: plan.word.height,
                  lineHeight: `${plan.word.height}px`,
                  ...plan.word.target.font,
                }}
              >
                {/* The layer mirrors in RTL; the copied text must not. */}
                <span
                  className="block"
                  style={{
                    transform: plan.targets.rtl ? 'scaleX(-1)' : undefined,
                  }}
                >
                  {plan.word.target.text}
                </span>
              </div>
            )}
            <div
              className="absolute top-0 opacity-0"
              data-skeleton-free-skull
              style={{
                left: 0,
                right: 'auto',
                width: plan.skullSize,
                height: plan.skullSize,
              }}
            >
              <div className="size-full" data-skeleton-turn>
                <SkeletonSkullArt />
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
};

export default HalloweenSkeletons;
