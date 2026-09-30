import type { CelebrationEvent } from '../models/celebration';
import halloweenLogoUrl from './assets/halloween-logo.svg';
import HalloweenBurstOverlay from './components/Halloween/HalloweenBurstOverlay';
import HalloweenDecor from './components/Halloween/HalloweenDecor';
import {
  HALLOWEEN_BURST_DURATION_MS,
  HALLOWEEN_CLICK_BURSTS,
  HALLOWEEN_SCENE_DURATIONS,
  HALLOWEEN_SECRET_BURSTS,
  HALLOWEEN_SECRET_PHRASE,
} from './constants/halloween';
import { HALLOWEEN_LABELS } from './constants/labels';
import type { HalloweenLabels } from './models/labels';
import { HalloweenDecorBehavior, HalloweenScene } from './types/halloween';

/** Options for building the Halloween event. */
export interface HalloweenEventOptions {
  /** Optional soundtrack for the train scene; silent when omitted. */
  trainSoundtrackUrl?: string;
}

const MESSAGES: Record<HalloweenScene, keyof HalloweenLabels> = {
  [HalloweenScene.Ghost]: 'ghostToastMessage',
  [HalloweenScene.Web]: 'webToastMessage',
  [HalloweenScene.Spiders]: 'spidersToastMessage',
  [HalloweenScene.Bats]: 'batsToastMessage',
  [HalloweenScene.Cat]: 'catToastMessage',
  [HalloweenScene.Witches]: 'witchesToastMessage',
  [HalloweenScene.Train]: 'trainToastMessage',
  [HalloweenScene.Portal]: 'portalToastMessage',
  [HalloweenScene.Ravens]: 'ravensToastMessage',
  [HalloweenScene.Candy]: 'candyToastMessage',
  [HalloweenScene.Footprints]: 'footprintsToastMessage',
  [HalloweenScene.Skeletons]: 'skeletonsToastMessage',
  [HalloweenScene.Cauldron]: 'cauldronToastMessage',
  [HalloweenScene.Mimic]: 'mimicToastMessage',
  [HalloweenScene.Bowling]: 'bowlingToastMessage',
  [HalloweenScene.Mummy]: 'mummyToastMessage',
};

/** Returns the Halloween celebration event. */
export const createHalloweenEvent = ({
  trainSoundtrackUrl,
}: HalloweenEventOptions = {}): CelebrationEvent => ({
  id: 'halloween',
  iconUrl: halloweenLogoUrl,
  Decoration: HalloweenDecor,
  scenes: Object.values(HalloweenScene).map((scene) => ({
    id: scene,
    Component: () => (
      <HalloweenBurstOverlay
        burst={scene}
        trainSoundtrackUrl={trainSoundtrackUrl}
      />
    ),
    durationMs: HALLOWEEN_SCENE_DURATIONS[scene] ?? HALLOWEEN_BURST_DURATION_MS,
    labelId: MESSAGES[scene],
  })),
  clickSceneIds: HALLOWEEN_CLICK_BURSTS,
  labels: { ...HALLOWEEN_LABELS },
  titleLabelId: 'toastTitle',
  decorBehaviors: Object.values(HalloweenDecorBehavior),
  secretTrigger: {
    phrases: [HALLOWEEN_SECRET_PHRASE],
    hintPhrase: HALLOWEEN_SECRET_PHRASE,
    sceneIds: HALLOWEEN_SECRET_BURSTS,
  },
});

/** The Halloween event with default options. */
export const halloweenEvent = createHalloweenEvent();
