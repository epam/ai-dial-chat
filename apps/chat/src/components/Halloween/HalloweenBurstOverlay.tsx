import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { HalloweenBurst } from '../../types/halloween';
import {
  buildHalloweenGhostFlight,
  buildHalloweenSpiderDrop,
  buildHalloweenWebLayout,
} from '../../utils/halloween';
import styles from './Halloween.module.scss';
import HalloweenCatScene from './HalloweenCatScene';
import HalloweenGhost from './HalloweenGhost';
import HalloweenNightFlight from './HalloweenNightFlight';
import HalloweenSpider from './HalloweenSpider';
import HalloweenWeb from './HalloweenWeb';

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
  const isMobile = useIsMobile();
  const webLayout = useMemo(
    () =>
      burst === HalloweenBurst.Web ? buildHalloweenWebLayout(isMobile) : null,
    [burst, isMobile],
  );
  const isGhostFlight = burst === HalloweenBurst.Ghost;
  /*
   * Laid out once per burst. The layer re-renders on every ancestor state
   * change, and re-rolling the paths would restart every flight mid-air.
   */
  const spiders = useMemo(
    () => (burst === HalloweenBurst.Spiders ? buildHalloweenSpiderDrop() : []),
    [burst],
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
      {webLayout && (
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          className={styles.webNetwork}
          focusable="false"
        >
          {webLayout.strands.map((strand) => (
            <path
              key={`${strand.from}-${strand.to}`}
              d={strand.path}
              style={strand.style}
              pathLength="1"
              vectorEffect="non-scaling-stroke"
              className={styles.webBridge}
            />
          ))}
        </svg>
      )}
      {webLayout?.webs.map((web, index) => (
        <HalloweenWeb key={index} style={web.style} />
      ))}
      {(burst === HalloweenBurst.Bats || burst === HalloweenBurst.Witches) && (
        <HalloweenNightFlight burst={burst} />
      )}
      {burst === HalloweenBurst.Cat && <HalloweenCatScene />}
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
