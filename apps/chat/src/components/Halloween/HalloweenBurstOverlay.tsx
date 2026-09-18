import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { HalloweenBurst } from '../../types/halloween';
import {
  buildHalloweenGhostFlight,
  buildHalloweenSpiderDrop,
} from '../../utils/halloween';
import styles from './Halloween.module.scss';
import HalloweenGhost from './HalloweenGhost';
import HalloweenSpider from './HalloweenSpider';

interface Props {
  /** Which celebration to play. */
  burst: HalloweenBurst;
}

/**
 * The full-viewport celebration layer of the Halloween easter egg, portaled to
 * `document.body` so no scroll container clips it.
 *
 * Purely decorative: the layer is `aria-hidden` and never takes pointer
 * events, and the announcement a screen-reader user gets is the notification
 * `HalloweenProvider` raises alongside it.
 */
const HalloweenBurstOverlay: FC<Props> = ({ burst }) => {
  const isGhostFlight = burst === HalloweenBurst.Ghost;
  /*
   * Laid out once per burst. The layer re-renders on every ancestor state
   * change, and re-rolling the paths would restart every flight mid-air.
   */
  const spiders = useMemo(
    () => (isGhostFlight ? [] : buildHalloweenSpiderDrop()),
    [isGhostFlight],
  );
  const ghosts = useMemo(
    () => (isGhostFlight ? buildHalloweenGhostFlight() : []),
    [isGhostFlight],
  );

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70] select-none overflow-hidden"
    >
      {/* Index is the identity in both lists: each is built once per burst and
          never reordered, and the drawings repeat. */}
      {ghosts.map((ghost, index) => (
        <span key={index} className={styles.ghost} style={ghost.style}>
          <HalloweenGhost
            variant={ghost.variant}
            className={styles.ghostBody}
          />
        </span>
      ))}
      {spiders.map((spider, index) => (
        <span key={index} className={styles.spiderDrop} style={spider.style}>
          <span className={styles.spiderSwing}>
            <span
              className={mergeClasses(
                styles.spiderThread,
                'bg-control-neutral-default',
              )}
            />
            <HalloweenSpider className={styles.spiderBody} />
          </span>
        </span>
      ))}
    </div>,
    document.body,
  );
};

export default memo(HalloweenBurstOverlay);
