import halloweenLogoUrl from '../assets/halloween-logo.svg?no-inline';
import HalloweenBurstOverlay from '../components/Halloween/HalloweenBurstOverlay';
import HalloweenDecor from '../components/Halloween/HalloweenDecor';
import {
  HALLOWEEN_BURST_DURATION_MS,
  HALLOWEEN_CLICK_BURSTS,
  HALLOWEEN_SECRET_PHRASE,
} from '../constants/halloween';
import { HalloweenI18nKeys } from '../constants/translation-keys';
import type { CelebrationEvent } from '../types/celebration';
import { HalloweenBurst } from '../types/halloween';

const messages: Record<HalloweenBurst, HalloweenI18nKeys> = {
  [HalloweenBurst.Ghost]: HalloweenI18nKeys.GhostToastMessage,
  [HalloweenBurst.Web]: HalloweenI18nKeys.WebToastMessage,
  [HalloweenBurst.Spiders]: HalloweenI18nKeys.SpidersToastMessage,
  [HalloweenBurst.Bats]: HalloweenI18nKeys.BatsToastMessage,
  [HalloweenBurst.Cat]: HalloweenI18nKeys.CatToastMessage,
  [HalloweenBurst.Witches]: HalloweenI18nKeys.WitchesToastMessage,
};

const halloween: CelebrationEvent = {
  id: 'halloween',
  iconUrl: halloweenLogoUrl,
  Decoration: HalloweenDecor,
  scenes: Object.values(HalloweenBurst).map((burst) => ({
    id: burst,
    Component: () => <HalloweenBurstOverlay burst={burst} />,
    durationMs: HALLOWEEN_BURST_DURATION_MS,
    notificationKey: messages[burst],
  })),
  clickSceneIds: HALLOWEEN_CLICK_BURSTS,
  notificationTitleKey: HalloweenI18nKeys.ToastTitle,
  secretTrigger: {
    phrases: [HALLOWEEN_SECRET_PHRASE],
    hintPhrase: HALLOWEEN_SECRET_PHRASE,
    sceneId: HalloweenBurst.Spiders,
  },
};

export default halloween;
