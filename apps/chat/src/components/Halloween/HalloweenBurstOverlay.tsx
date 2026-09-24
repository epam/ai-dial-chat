import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { HalloweenBurst } from '../../types/halloween';
import {
  buildHalloweenGhostFlight,
  buildHalloweenSpiderDrop,
  buildHalloweenWebLayout,
} from '../../utils/halloween';
import styles from './Halloween.module.scss';
import HalloweenCatScene from './HalloweenCatScene';
import {
  HalloweenTrain,
  HalloweenRavens,
  HalloweenCandy,
  HalloweenFootprints,
  HalloweenSkeletons,
} from './HalloweenExtras';
import HalloweenGhost from './HalloweenGhost';
import HalloweenNightFlight from './HalloweenNightFlight';
import HalloweenPortal from './HalloweenPortal';
import HalloweenSpider from './HalloweenSpider';
import HalloweenWeb from './HalloweenWeb';

const extraScenes: Partial<Record<HalloweenBurst, FC>> = {
  [HalloweenBurst.Train]: HalloweenTrain,
  [HalloweenBurst.Portal]: HalloweenPortal,
  [HalloweenBurst.Ravens]: HalloweenRavens,
  [HalloweenBurst.Candy]: HalloweenCandy,
  [HalloweenBurst.Footprints]: HalloweenFootprints,
  [HalloweenBurst.Skeletons]: HalloweenSkeletons,
};

interface Props {
  /** Which celebration to play. */
  burst: HalloweenBurst;
}

/** Scene artwork only; the shared celebration runtime supplies its viewport layer. */
const HalloweenBurstOverlay: FC<Props> = ({ burst }) => {
  const ExtraScene = extraScenes[burst];
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

  return (
    <>
      {ExtraScene && <ExtraScene />}
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
    </>
  );
};

export default memo(HalloweenBurstOverlay);
