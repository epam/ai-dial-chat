import type { CelebrationEvent } from '../models/celebration';
import iconUrl from './assets/new-year-logo.svg';
import NewYearDecor from './components/NewYear/NewYearDecor';
import NewYearSceneOverlay from './components/NewYear/NewYearSceneOverlay';
import { NEW_YEAR_LABELS } from './constants/labels';
import {
  NEW_YEAR_CLICK_SCENES,
  NEW_YEAR_SCENE_DURATIONS,
  NEW_YEAR_SECRET_PHRASE,
} from './constants/new-year';
import type { NewYearLabels } from './models/labels';
import { NewYearScene } from './types/new-year';

const MESSAGES: Record<NewYearScene, keyof NewYearLabels> = {
  [NewYearScene.PenguinStar]: 'penguinStarToastMessage',
  [NewYearScene.GiftWrapping]: 'giftWrappingToastMessage',
  [NewYearScene.Snow]: 'snowToastMessage',
  [NewYearScene.Confetti]: 'confettiToastMessage',
  [NewYearScene.Sleigh]: 'sleighToastMessage',
};

/** The New Year celebration event. */
export const newYearEvent: CelebrationEvent = {
  id: 'new-year',
  iconUrl,
  Decoration: NewYearDecor,
  scenes: Object.values(NewYearScene).map((scene) => ({
    id: scene,
    Component: () => <NewYearSceneOverlay scene={scene} />,
    durationMs: NEW_YEAR_SCENE_DURATIONS[scene],
    labelId: MESSAGES[scene],
  })),
  clickSceneIds: NEW_YEAR_CLICK_SCENES,
  labels: { ...NEW_YEAR_LABELS },
  titleLabelId: 'toastTitle',
  secretTrigger: {
    phrases: [NEW_YEAR_SECRET_PHRASE],
    hintPhrase: NEW_YEAR_SECRET_PHRASE,
    sceneIds: [NewYearScene.Confetti],
  },
};
