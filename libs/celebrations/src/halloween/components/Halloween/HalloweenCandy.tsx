import { useCallback, useEffect, useRef, useState, type FC } from 'react';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { animateCandy } from '../../utils/halloween-candy-animation';
import {
  buildCandyPlan,
  CandyJanitorKind,
  type CandyPlan,
} from '../../utils/halloween-candy-plan';
import { getCandyTargets } from '../../utils/halloween-candy-targets';
import { CandyJanitor, CandyRaven, CandySweet } from './HalloweenCandyArt';

/** Three rounds of rivalry over sweets, with measured contacts and an untouched host. */
const HalloweenCandy: FC = () => {
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
  const [plan, setPlan] = useState<CandyPlan | null>(null);
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
    Promise.resolve().then(() => {
      if (!disposed && !stopped.current)
        setPlan(buildCandyPlan(getCandyTargets(anchors, isMobile), isMobile));
    });
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
    const cancel = animateCandy(plan, host.current, () => {
      if (!disposed) stop();
    });
    return () => {
      disposed = true;
      cancel();
    };
  }, [plan, stationary, changed, ended, stop]);
  return (
    <div
      ref={host}
      className="pointer-events-none absolute inset-0 select-none overflow-clip"
      aria-hidden="true"
      inert
      data-halloween-scene="candy"
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
          className="absolute inset-x-0 bottom-6 flex items-end justify-center gap-1"
          data-candy-static
        >
          {[0, 1].map((i) => (
            <div key={i} className="size-10">
              <CandyRaven />
            </div>
          ))}
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-4 w-5">
              <CandySweet variant={i} />
            </div>
          ))}
          {[
            CandyJanitorKind.Mummy,
            CandyJanitorKind.Skeleton,
            CandyJanitorKind.Skeleton,
          ].map((kind, i) => (
            <div key={i} className="h-[68px] w-[60px]">
              <CandyJanitor kind={kind} />
            </div>
          ))}
        </div>
      ) : (
        plan && (
          <>
            {plan.sweets.map((_, i) => (
              <div
                key={i}
                className="absolute top-0 opacity-0"
                data-candy-sweet={i}
                style={{
                  left: 0,
                  right: 'auto',
                  width: plan.radius * 2.6,
                  height: plan.radius * 2,
                  marginLeft: -plan.radius * 1.3,
                  marginTop: -plan.radius,
                }}
              >
                <CandySweet variant={i} />
              </div>
            ))}
            {[...plan.janitors.keys()].reverse().map((i) => (
              <div
                key={i}
                className="absolute top-0 opacity-0"
                data-candy-janitor={i}
                style={{
                  left: 0,
                  right: 'auto',
                  width: 160 * plan.janitorScale,
                  height: 180 * plan.janitorScale,
                }}
              >
                <div className="size-full" data-candy-facing>
                  <CandyJanitor kind={plan.janitors[i].kind} />
                </div>
              </div>
            ))}
            {plan.birds.map((_, i) => (
              <div
                key={i}
                className="absolute top-0 opacity-0"
                data-candy-bird={i}
                style={{
                  left: 0,
                  right: 'auto',
                  width: 100 * plan.birdScale,
                  height: 100 * plan.birdScale,
                }}
              >
                <div className="size-full" data-candy-facing>
                  <CandyRaven />
                </div>
              </div>
            ))}
          </>
        )
      )}
    </div>
  );
};
export default HalloweenCandy;
