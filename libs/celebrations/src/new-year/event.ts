import type { CelebrationEvent } from '../models/celebration';
import iconUrl from './assets/new-year-logo.svg';
import NewYearDecor from './components/NewYear/NewYearDecor';
import {
  NewYearConfetti,
  NewYearSnow,
} from './components/NewYear/NewYearParticles';
import NewYearSleigh from './components/NewYear/NewYearSleigh';
import { NewYearScene } from './components/NewYear/types';
import { NEW_YEAR_LABELS } from './constants/labels';

/** The New Year celebration event. */
export const newYearEvent: CelebrationEvent = {
  id: 'new-year',
  iconUrl,
  Decoration: NewYearDecor,
  scenes: [
    {
      id: NewYearScene.Snow,
      Component: NewYearSnow,
      durationMs: 12000,
      labelId: 'snowToastMessage',
    },
    {
      id: NewYearScene.Confetti,
      Component: NewYearConfetti,
      durationMs: 9000,
      labelId: 'confettiToastMessage',
    },
    {
      id: NewYearScene.Sleigh,
      Component: NewYearSleigh,
      durationMs: 12000,
      labelId: 'sleighToastMessage',
    },
  ],
  clickSceneIds: Object.values(NewYearScene),
  labels: { ...NEW_YEAR_LABELS },
  titleLabelId: 'toastTitle',
  secretTrigger: {
    phrases: ['happy new year'],
    hintPhrase: 'happy new year',
    sceneIds: [NewYearScene.Confetti],
  },
};
