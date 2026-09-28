import { useMemo, useState, type FC } from 'react';
import {
  CelebrationEnvironmentContext,
  type CelebrationEnvironment,
} from '../context/CelebrationEnvironmentContext';
import HalloweenDecor from '../halloween/components/Halloween/HalloweenDecor';
import { HALLOWEEN_LABELS } from '../halloween/constants/labels';
import type { HalloweenDecorBehavior } from '../halloween/types/halloween';
import { STORY_ANCHORS, StoryHostPage } from './StoryHostPage';

export interface HalloweenBehaviorPlayerProps {
  /** The only corner-spider behavior left on. */
  behavior: HalloweenDecorBehavior;
  /** Idle time before the pumpkin wrap starts, in ms. */
  wrapIdleMs?: number;
  /** Pause range between thread drops, in ms. */
  dropDelayMs?: readonly [number, number];
  /** Document direction of the fixture page. */
  dir?: 'ltr' | 'rtl';
}

/** Shows the Halloween decoration with a single corner-spider behavior enabled. */
export const HalloweenBehaviorPlayer: FC<HalloweenBehaviorPlayerProps> = ({
  behavior,
  wrapIdleMs = 3000,
  dropDelayMs = [1500, 2500],
  dir = 'ltr',
}) => {
  const [clicks, setClicks] = useState(0);
  const environment = useMemo<CelebrationEnvironment>(
    () => ({
      isMobile: false,
      anchors: STORY_ANCHORS,
      labels: { ...HALLOWEEN_LABELS },
      isDecorBehaviorEnabled: (candidate) => candidate === behavior,
      timings: {
        spiderDropDelayMs: dropDelayMs,
        pumpkinWrapIdleMs: wrapIdleMs,
      },
    }),
    [behavior, dropDelayMs, wrapIdleMs],
  );

  return (
    <div dir={dir}>
      <CelebrationEnvironmentContext.Provider value={environment}>
        <StoryHostPage>
          <HalloweenDecor onActivate={() => setClicks((count) => count + 1)} />
        </StoryHostPage>
      </CelebrationEnvironmentContext.Provider>
      <p role="status" className="fixed end-3 top-3 rounded border p-2">
        Pumpkin clicks: {clicks}
      </p>
    </div>
  );
};
