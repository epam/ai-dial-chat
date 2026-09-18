import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { CSSProperties, FC } from 'react';
import { memo, useEffect, useRef, useState } from 'react';
import {
  HALLOWEEN_SPIDER_FLEE_RADIUS_PX,
  HALLOWEEN_SPIDER_FLEE_STEP_PX,
  HALLOWEEN_SPIDER_MAX_OFFSET_PX,
  HALLOWEEN_SPIDER_RETURN_MS,
} from '../../constants/halloween';
import { nextHalloweenSpiderOffset } from '../../utils/halloween';
import styles from './Halloween.module.scss';
import HalloweenSpider from './HalloweenSpider';

const AT_REST = { x: 0, y: 0 };

interface Props {
  /** Where the spider perches on its web, as Tailwind position classes. */
  className?: string;
}

/**
 * A spider perched on a corner cobweb that keeps its distance from the
 * pointer: every time the cursor comes within
 * `HALLOWEEN_SPIDER_FLEE_RADIUS_PX` it bolts directly away, so chasing it
 * around the web works, and after `HALLOWEEN_SPIDER_RETURN_MS` undisturbed it
 * creeps back to its perch.
 *
 * Deliberately pointer-only and `aria-hidden`: it accomplishes nothing, so
 * there is nothing a keyboard user is missing, and making a decoration
 * focusable inside a hidden layer would cost more than it gives. Under
 * `prefers-reduced-motion: reduce` the spider never moves at all — the check
 * is here rather than in the stylesheet because the offset is an inline
 * transform, which a media query could not override.
 */
const HalloweenCornerSpider: FC<Props> = ({ className }) => {
  const spiderRef = useRef<HTMLSpanElement>(null);
  const [offset, setOffset] = useState(AT_REST);
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

    let frame = 0;
    let pointer: { x: number; y: number } | null = null;
    let returnTimer: number | undefined;

    const settle = () => {
      offsetRef.current = AT_REST;
      setOffset(AT_REST);
    };

    const step = () => {
      frame = 0;
      if (!perch || !pointer) return;

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
      pointer = { x: event.clientX, y: event.clientY };
      frame ||= window.requestAnimationFrame(step);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('resize', measure);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', measure);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(returnTimer);
    };
  }, []);

  return (
    <span
      ref={spiderRef}
      aria-hidden="true"
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
      <HalloweenSpider className="h-6" />
    </span>
  );
};

export default memo(HalloweenCornerSpider);
