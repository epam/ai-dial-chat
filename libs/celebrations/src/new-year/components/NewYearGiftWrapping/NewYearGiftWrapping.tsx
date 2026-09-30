import { useEffect, useId, useRef, useState, type FC } from 'react';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { animateGiftWrapping } from '../../utils/gift-wrapping-animation';
import {
  buildGiftWrappingPlan,
  type GiftWrappingPlan,
} from '../../utils/gift-wrapping-plan';
import { getGiftWrappingTarget } from '../../utils/gift-wrapping-targets';
import { GiftBow, GiftElf } from './GiftWrappingArt';

/** Two elves wrap the composer, free a caught hat and depart with its new bow. */
const NewYearGiftWrapping: FC = () => {
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
      typeof ResizeObserver === 'function' &&
      typeof MutationObserver === 'function',
  );
  const stationary = reduced || !supported;
  const [plan, setPlan] = useState<GiftWrappingPlan | null>(null);
  const [ended, setEnded] = useState(false);
  const host = useRef<SVGSVGElement>(null);
  const stopPlayback = useRef<(() => void) | null>(null);
  const cancelled = useRef(false);
  const id = useId();

  useEffect(() => {
    if (changed || ended) return;
    let disposed = false;
    const stop = (event?: Event) => {
      if (event?.type === 'visibilitychange' && !document.hidden) return;
      cancelled.current = true;
      if (host.current) host.current.style.visibility = 'hidden';
      stopPlayback.current?.();
      setEnded(true);
    };
    const events = [
      'pointerdown',
      'click',
      'keydown',
      'focusin',
      'focusout',
      'beforeinput',
      'input',
      'compositionstart',
      'scroll',
      'resize',
      'visibilitychange',
    ];
    events.forEach((name) => window.addEventListener(name, stop, true));
    window.visualViewport?.addEventListener('resize', stop);
    window.visualViewport?.addEventListener('scroll', stop);
    const prepare = async () => {
      await Promise.resolve();
      if (disposed || cancelled.current || stationary) return;
      if (document.hidden) {
        stop();
        return;
      }
      setPlan(
        buildGiftWrappingPlan(
          getGiftWrappingTarget(anchors, isMobile),
          isMobile,
        ),
      );
    };
    prepare();
    return () => {
      disposed = true;
      events.forEach((name) => window.removeEventListener(name, stop, true));
      window.visualViewport?.removeEventListener('resize', stop);
      window.visualViewport?.removeEventListener('scroll', stop);
    };
  }, [anchors, isMobile, stationary, changed, ended]);

  useEffect(() => {
    if (
      !plan ||
      !host.current ||
      stationary ||
      changed ||
      ended ||
      cancelled.current
    )
      return;
    let disposed = false;
    const stop = animateGiftWrapping(plan, host.current, () => {
      if (!disposed) setEnded(true);
    });
    stopPlayback.current = stop;
    return () => {
      disposed = true;
      stop();
      stopPlayback.current = null;
    };
  }, [plan, stationary, changed, ended]);

  if (ended || changed) return null;
  if (stationary)
    return (
      <div
        className="pointer-events-none absolute bottom-8 start-1/2 h-32 w-52 -translate-x-1/2 rtl:translate-x-1/2"
        inert
        aria-hidden="true"
      >
        <svg viewBox="0 0 220 145" focusable="false" data-gift-static>
          <g transform="translate(65 136) scale(.85)">
            <GiftElf stationary />
          </g>
          <g transform="translate(158 136) scale(-.8 .8)">
            <GiftElf helper stationary />
          </g>
        </svg>
      </div>
    );
  if (!plan) return null;
  const { box, width, height, source } = plan.target;
  const right = box.left + box.width;
  const bottom = box.top + box.height;
  const mid = box.left + box.width / 2;
  const ribbon = `url(#${id}-ribbon)`;
  return (
    <div
      className="pointer-events-none absolute inset-0 select-none overflow-clip"
      inert
      aria-hidden="true"
    >
      <svg
        ref={host}
        className="size-full"
        viewBox={`0 0 ${width} ${height}`}
        focusable="false"
        data-new-year-scene="gift-wrapping"
        data-gift-target={source ? 'composer' : 'parcel'}
      >
        <defs>
          <linearGradient
            id={`${id}-ribbon`}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={box.top - 4}
            x2="0"
            y2={box.top + 4}
          >
            <stop stopColor="#ffe8aa" />
            <stop offset=".45" stopColor="#eabd64" />
            <stop offset="1" stopColor="#ba7f35" />
          </linearGradient>
        </defs>
        <g
          data-gift-parcel
          opacity={source ? 0 : 1}
          visibility={source ? 'hidden' : undefined}
        >
          <rect
            x={box.left}
            y={box.top}
            width={box.width}
            height={box.height}
            rx="8"
            fill="#245e60"
            stroke="#74a79b"
            strokeWidth="2"
          />
          <path
            d={`M${box.left + 2} ${box.top + 12}H${right - 2}`}
            stroke="#113e44"
            strokeWidth="3"
          />
        </g>
        <g
          fill="none"
          stroke={ribbon}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            data-gift-ribbon="4"
            d={`M${box.left + 8} ${bottom}H${right - 8}`}
            style={{ transformOrigin: `${mid}px ${bottom}px` }}
          />
          <path
            data-gift-ribbon="2"
            d={`M${box.left + 8} ${box.top}Q${box.left} ${box.top} ${box.left} ${box.top + 8}V${bottom - 8}Q${box.left} ${bottom} ${box.left + 8} ${bottom}`}
            style={{ transformOrigin: `${box.left}px ${box.top}px` }}
          />
          <path
            data-gift-ribbon="3"
            d={`M${right - 8} ${box.top}Q${right} ${box.top} ${right} ${box.top + 8}V${bottom - 8}Q${right} ${bottom} ${right - 8} ${bottom}`}
            style={{ transformOrigin: `${right}px ${box.top}px` }}
          />
          <path
            data-gift-ribbon="0"
            d={`M${mid} ${box.top}H${box.left + 8}`}
            style={{ transformOrigin: `${mid}px ${box.top}px` }}
          />
          <path
            data-gift-ribbon="1"
            d={`M${mid} ${box.top}H${right - 8}`}
            style={{ transformOrigin: `${mid}px ${box.top}px` }}
          />
          <path
            data-gift-ribbon="5"
            d={`M${mid} ${box.top}V${bottom}`}
            strokeWidth="10"
            style={{ transformOrigin: `${mid}px ${box.top}px` }}
          />
        </g>
        <g data-gift-elf="0">
          <GiftElf />
        </g>
        <g data-gift-elf="1">
          <GiftElf helper />
        </g>
        <g
          transform={`translate(${plan.knot.x} ${plan.knot.y}) scale(${plan.scale * 0.91})`}
        >
          <g data-gift-knot>
            <GiftBow />
          </g>
        </g>
      </svg>
    </div>
  );
};

export default NewYearGiftWrapping;
