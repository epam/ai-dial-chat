import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { HALLOWEEN_SPIDER_RETURN_MS } from '../../constants/halloween';
import styles from './Halloween.module.scss';
import HalloweenSpider from './HalloweenSpider';

interface Props {
  /** Absolute placement on the corner cobweb, as Tailwind position classes. */
  className?: string;
}

/**
 * A spider perched on a corner cobweb that scurries out of the way when the
 * pointer reaches it, then creeps back after `HALLOWEEN_SPIDER_RETURN_MS`.
 *
 * Deliberately pointer-only and `aria-hidden`: it accomplishes nothing, so
 * there is nothing a keyboard user is missing, and making a decoration
 * focusable inside a hidden layer would cost more than it gives. The dash is a
 * transform transition, so it is suppressed with the rest of the animation
 * under `prefers-reduced-motion: reduce`.
 */
const HalloweenCornerSpider: FC<Props> = ({ className }) => {
  const [isFleeing, setIsFleeing] = useState(false);
  const returnTimerRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(returnTimerRef.current);
    },
    [],
  );

  const handlePointerEnter = useCallback(() => {
    /* Re-entering mid-dash restarts the countdown rather than queueing a
       second one, so the spider cannot be cornered into flickering. */
    window.clearTimeout(returnTimerRef.current);
    setIsFleeing(true);
    returnTimerRef.current = window.setTimeout(
      () => setIsFleeing(false),
      HALLOWEEN_SPIDER_RETURN_MS,
    );
  }, []);

  return (
    <span
      aria-hidden="true"
      onMouseEnter={handlePointerEnter}
      className={mergeClasses(
        'pointer-events-auto absolute',
        styles.cornerSpider,
        isFleeing && styles.cornerSpiderFleeing,
        className,
      )}
    >
      <HalloweenSpider className="h-6" />
    </span>
  );
};

export default memo(HalloweenCornerSpider);
