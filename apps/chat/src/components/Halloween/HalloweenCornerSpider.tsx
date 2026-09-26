import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { CSSProperties, FC, RefObject } from 'react';
import { memo, useEffect, useRef, useState } from 'react';
import {
  HALLOWEEN_SPIDER_ALERT_RADIUS_PX,
  HALLOWEEN_SPIDER_DROP_DELAY_MS,
  HALLOWEEN_SPIDER_DROP_DEPTH_PX,
  HALLOWEEN_SPIDER_DROP_MS,
  HALLOWEEN_SPIDER_DRUM_MS,
  HALLOWEEN_SPIDER_FLEE_RADIUS_PX,
  HALLOWEEN_SPIDER_FLEE_STEP_PX,
  HALLOWEEN_SPIDER_MAX_OFFSET_PX,
  HALLOWEEN_SPIDER_RETRACT_MS,
  HALLOWEEN_SPIDER_RETURN_MS,
  HALLOWEEN_SPIDER_WATCH_MAX_DEG,
  HALLOWEEN_SPIDER_WRAP_IDLE_MS,
} from '../../constants/halloween';
import { HalloweenSpiderMood } from '../../types/halloween';
import {
  buildHalloweenSpiderDangle,
  getHalloweenSpiderDangleTransform,
  getHalloweenSpiderDanglePose,
  nextHalloweenSpiderOffset,
  pickHalloweenRange,
  type HalloweenSpiderDanglePose,
} from '../../utils/halloween';
import {
  buildHalloweenSpiderWrapPlan,
  playHalloweenSpiderWrap,
  type HalloweenSpiderWrapPlan,
  type HalloweenSpiderWrapPlayback,
} from '../../utils/halloween-spider-wrap';
import styles from './Halloween.module.scss';
import HalloweenSpider from './HalloweenSpider';

const AT_REST = { x: 0, y: 0 };
const HANGING = { depth: 0, angle: 0 };
/* Everything a user does counts as attention; only a quiet page is "alone". */
const ACTIVITY_EVENTS = [
  'pointerdown',
  'wheel',
  'touchstart',
  'focusin',
  'scroll',
];

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement);

interface Props {
  /** Where the spider perches on its web, as Tailwind position classes. */
  className?: string;
  /** The pumpkin the spider wraps after a long quiet spell. */
  pumpkinRef?: RefObject<HTMLElement | null>;
  /** The silk overlay drawn over that pumpkin. */
  silkRef?: RefObject<SVGSVGElement | null>;
}

/**
 * A spider perched on a corner cobweb. Left alone it fidgets, leans to keep
 * the pointer in view and now and then lowers itself on a thread. Within
 * `HALLOWEEN_SPIDER_ALERT_RADIUS_PX` it reels in and freezes to watch; within
 * `HALLOWEEN_SPIDER_FLEE_RADIUS_PX` it bolts directly away, so chasing it
 * around the web works, and after `HALLOWEEN_SPIDER_RETURN_MS` undisturbed it
 * creeps back to its perch. It drums its legs while the user types, and after
 * `HALLOWEEN_SPIDER_WRAP_IDLE_MS` of complete quiet it climbs down to wrap the
 * pumpkin in silk until the pumpkin shakes it off.
 *
 * Deliberately pointer-only and `aria-hidden`: it accomplishes nothing, so
 * there is nothing a keyboard user is missing, and making a decoration
 * focusable inside a hidden layer would cost more than it gives. Under
 * `prefers-reduced-motion: reduce` the spider never moves at all — the check
 * is here rather than in the stylesheet because the offset is an inline
 * transform, which a media query could not override.
 */
const HalloweenCornerSpider: FC<Props> = ({
  className,
  pumpkinRef,
  silkRef,
}) => {
  const spiderRef = useRef<HTMLSpanElement>(null);
  const dangleRef = useRef<HTMLSpanElement>(null);
  const threadRef = useRef<HTMLSpanElement>(null);
  const watchRef = useRef<HTMLSpanElement>(null);
  const [offset, setOffset] = useState(AT_REST);
  const [mood, setMood] = useState(HalloweenSpiderMood.Idle);
  const offsetRef = useRef(AT_REST);
  const isFleeing = offset !== AT_REST;

  useEffect(() => {
    /* Optional-chained: a host without `matchMedia` should get the ordinary
       spider rather than a crash, and "no preference" is the right default. */
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    /*
     * The perch is measured rather than tracked: reading the live rect on
     * every move would sample the element mid-transition and feed its own
     * motion back in as a chase. Position is the perch plus the offset we
     * last chose, which is stable.
     */
    let perch: { x: number; y: number } | null = null;
    const measure = () => {
      const rect = spiderRef.current?.getBoundingClientRect();
      if (!rect) return;
      perch = {
        x: rect.left + rect.width / 2 - offsetRef.current.x,
        y: rect.top + rect.height / 2 - offsetRef.current.y,
      };
    };
    measure();

    const pupils = watchRef.current?.querySelector<SVGGElement>(
      '[data-spider-pupils]',
    );
    let frame = 0;
    let pointer: { x: number; y: number } | null = null;
    let returnTimer: number | undefined;
    let dropTimer: number | undefined;
    let alert = false;
    let drop: { animations: Animation[]; depth: number } | null = null;
    let wrapTimer: number | undefined;
    let wrap: {
      plan: HalloweenSpiderWrapPlan;
      playback: HalloweenSpiderWrapPlayback;
    } | null = null;
    let lastActivity = Date.now();
    let drumTimer: number | undefined;

    const scheduleDrop = () => {
      window.clearTimeout(dropTimer);
      dropTimer = window.setTimeout(
        startDrop,
        pickHalloweenRange(HALLOWEEN_SPIDER_DROP_DELAY_MS),
      );
    };

    /* The spider and its thread share one timeline, so the silk always ends
       exactly at the spider. */
    const startDrop = () => {
      const dangle = dangleRef.current;
      const thread = threadRef.current;
      if (!dangle || !thread || typeof dangle.animate !== 'function') return;
      if (alert || wrap || offsetRef.current !== AT_REST) {
        scheduleDrop();
        return;
      }
      const depth = pickHalloweenRange(HALLOWEEN_SPIDER_DROP_DEPTH_PX);
      const frames = buildHalloweenSpiderDangle(depth);
      const timing = { duration: HALLOWEEN_SPIDER_DROP_MS };
      const animations = [
        dangle.animate(frames.dangle, timing),
        thread.animate(frames.thread, timing),
      ];
      drop = { animations, depth };
      animations[0].onfinish = () => {
        drop = null;
        scheduleDrop();
      };
    };

    /* Reels in from a pose computed rather than read back from the page. */
    const reelIn = (pose: HalloweenSpiderDanglePose) => {
      const dangle = dangleRef.current;
      const thread = threadRef.current;
      if (!dangle || !thread) return;
      const timing = {
        duration: HALLOWEEN_SPIDER_RETRACT_MS,
        easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
      };
      dangle.animate(
        [
          { transform: getHalloweenSpiderDangleTransform(pose) },
          { transform: getHalloweenSpiderDangleTransform(HANGING) },
        ],
        timing,
      );
      thread.animate(
        [{ transform: `scaleY(${pose.depth})` }, { transform: 'scaleY(0)' }],
        timing,
      );
    };

    const retract = () => {
      if (!drop) return;
      const elapsed = Number(drop.animations[0].currentTime ?? 0);
      const pose = getHalloweenSpiderDanglePose(
        drop.depth,
        Math.min(1, elapsed / HALLOWEEN_SPIDER_DROP_MS),
      );
      drop.animations.forEach((animation) => {
        animation.onfinish = null;
        animation.cancel();
      });
      drop = null;
      reelIn(pose);
      scheduleDrop();
    };

    const scheduleWrap = (delay = HALLOWEEN_SPIDER_WRAP_IDLE_MS) => {
      window.clearTimeout(wrapTimer);
      wrapTimer = window.setTimeout(startWrap, delay);
    };

    /* Measures once, when the story starts; nothing is read while it plays. */
    const startWrap = () => {
      const quiet = Date.now() - lastActivity;
      if (quiet < HALLOWEEN_SPIDER_WRAP_IDLE_MS) {
        scheduleWrap(HALLOWEEN_SPIDER_WRAP_IDLE_MS - quiet);
        return;
      }
      const spider = spiderRef.current;
      const dangle = dangleRef.current;
      const thread = threadRef.current;
      const pumpkin = pumpkinRef?.current;
      const silk = silkRef?.current;
      const cocoon = silk?.querySelector('[data-silk-cocoon]');
      const group = silk?.querySelector('[data-silk-group]');
      if (
        !spider ||
        !dangle ||
        !thread ||
        !pumpkin ||
        !silk ||
        !cocoon ||
        !group ||
        typeof dangle.animate !== 'function'
      )
        return;
      /* Let an idle drop or an escape finish before starting the story. */
      if (drop || offsetRef.current !== AT_REST) {
        scheduleWrap(1000);
        return;
      }
      window.clearTimeout(dropTimer);
      const box = spider.getBoundingClientRect();
      const plan = buildHalloweenSpiderWrapPlan({
        pivot: { x: box.left + box.width / 2, y: box.top + box.height * 0.17 },
        spiderHeight: box.height,
        pumpkin: pumpkin.getBoundingClientRect(),
      });
      const playback = playHalloweenSpiderWrap(
        plan,
        {
          dangle,
          thread,
          strands: Array.from(silk.querySelectorAll('[data-silk-strand]')),
          cocoon,
          silk: group,
          pumpkin,
        },
        {
          onMood: setMood,
          onEnd: () => {
            wrap = null;
            setMood(HalloweenSpiderMood.Idle);
            scheduleDrop();
            scheduleWrap();
          },
        },
      );
      wrap = { plan, playback };
    };

    const abortWrap = () => {
      if (!wrap) return;
      const pose = wrap.plan.poseAt(wrap.playback.elapsed());
      wrap.playback.abort();
      wrap = null;
      reelIn(pose);
      setMood(HalloweenSpiderMood.Idle);
      scheduleDrop();
    };

    /* Cheap on every event: the timer checks the quiet spell when it fires. */
    const handleActivity = () => {
      lastActivity = Date.now();
      abortWrap();
    };

    /* Taps alternate between two legs, so each keystroke restarts a tap. */
    const handleKeyDown = (event: KeyboardEvent) => {
      handleActivity();
      const spider = spiderRef.current;
      if (!spider || !isEditable(event.target)) return;
      spider.dataset.spiderTap = spider.dataset.spiderTap === 'a' ? 'b' : 'a';
      window.clearTimeout(drumTimer);
      drumTimer = window.setTimeout(() => {
        delete spider.dataset.spiderTap;
      }, HALLOWEEN_SPIDER_DRUM_MS);
    };

    const handleVisibility = () => {
      if (document.hidden) handleActivity();
    };

    const settle = () => {
      offsetRef.current = AT_REST;
      setOffset(AT_REST);
    };

    const step = () => {
      frame = 0;
      if (!perch || !pointer) return;

      /* Leaning and pupils are written straight to the DOM: they follow
         every pointer frame and must not re-render the component. */
      const awayX = pointer.x - (perch.x + offsetRef.current.x);
      const awayY = pointer.y - (perch.y + offsetRef.current.y);
      const lean = Math.max(-1, Math.min(1, awayX / 320));
      if (watchRef.current) {
        watchRef.current.style.transform = `rotate(${(lean * HALLOWEEN_SPIDER_WATCH_MAX_DEG).toFixed(1)}deg)`;
      }
      pupils?.style.setProperty(
        'transform',
        `translate(${(lean * 1.2).toFixed(2)}px, ${(Math.max(-1, Math.min(1, awayY / 200)) * 1.2).toFixed(2)}px)`,
      );

      const isNear =
        Math.hypot(awayX, awayY) <= HALLOWEEN_SPIDER_ALERT_RADIUS_PX;
      if (isNear !== alert) {
        alert = isNear;
        setMood(isNear ? HalloweenSpiderMood.Alert : HalloweenSpiderMood.Idle);
      }
      if (alert) retract();

      const next = nextHalloweenSpiderOffset({
        perch,
        pointer,
        offset: offsetRef.current,
        fleeRadius: HALLOWEEN_SPIDER_FLEE_RADIUS_PX,
        fleeStep: HALLOWEEN_SPIDER_FLEE_STEP_PX,
        maxOffset: HALLOWEEN_SPIDER_MAX_OFFSET_PX,
      });
      if (next == null) return;

      offsetRef.current = next;
      setOffset(next);
      window.clearTimeout(returnTimer);
      returnTimer = window.setTimeout(settle, HALLOWEEN_SPIDER_RETURN_MS);
    };

    /* Coalesced into one frame: a pointer crossing the web fires far more
       moves than there are frames to render them. */
    const handlePointerMove = (event: PointerEvent) => {
      handleActivity();
      pointer = { x: event.clientX, y: event.clientY };
      frame ||= window.requestAnimationFrame(step);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('resize', measure);
    window.addEventListener('keydown', handleKeyDown, true);
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity, {
        capture: true,
        passive: true,
      }),
    );
    document.addEventListener('visibilitychange', handleVisibility);
    scheduleDrop();
    scheduleWrap();

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', measure);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(returnTimer);
      window.removeEventListener('keydown', handleKeyDown, true);
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, handleActivity, true),
      );
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearTimeout(dropTimer);
      window.clearTimeout(wrapTimer);
      window.clearTimeout(drumTimer);
      drop?.animations.forEach((animation) => animation.cancel());
      wrap?.playback.cancel();
    };
  }, [pumpkinRef, silkRef]);

  return (
    <span
      ref={spiderRef}
      aria-hidden="true"
      data-spider-state={mood}
      className={mergeClasses(
        'absolute',
        styles.cornerSpider,
        isFleeing && styles.cornerSpiderFleeing,
        className,
      )}
      style={
        {
          /* Tilts into the direction of travel, so a sprint reads as a sprint
             and not a slide. */
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${(offset.x * 0.18).toFixed(1)}deg)`,
        } as CSSProperties
      }
    >
      <span ref={dangleRef} className={styles.cornerSpiderDangle}>
        <span ref={threadRef} className={styles.cornerSpiderThread} />
        <span ref={watchRef} className={styles.cornerSpiderWatch}>
          <HalloweenSpider className="h-9 desktop:h-11" />
        </span>
      </span>
    </span>
  );
};

export default memo(HalloweenCornerSpider);
