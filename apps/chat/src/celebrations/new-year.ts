import iconUrl from '../assets/new-year-logo.svg?no-inline';
import NewYearDecor from '../components/NewYear/NewYearDecor';
import {
  NewYearConfetti,
  NewYearSnow,
} from '../components/NewYear/NewYearParticles';
import NewYearSleigh from '../components/NewYear/NewYearSleigh';
import { NewYearScene } from '../components/NewYear/types';
import { NewYearI18nKeys } from '../constants/translation-keys';
import type { CelebrationEvent } from '../types/celebration';

const newYear: CelebrationEvent = {
  id: 'new-year',
  iconUrl,
  Decoration: NewYearDecor,
  scenes: [
    {
      id: NewYearScene.Snow,
      Component: NewYearSnow,
      durationMs: 12000,
      notificationKey: NewYearI18nKeys.SnowToastMessage,
    },
    {
      id: NewYearScene.Confetti,
      Component: NewYearConfetti,
      durationMs: 9000,
      notificationKey: NewYearI18nKeys.ConfettiToastMessage,
    },
    {
      id: NewYearScene.Sleigh,
      Component: NewYearSleigh,
      durationMs: 12000,
      notificationKey: NewYearI18nKeys.SleighToastMessage,
    },
  ],
  clickSceneIds: Object.values(NewYearScene),
  notificationTitleKey: NewYearI18nKeys.ToastTitle,
  secretTrigger: {
    phrases: ['happy new year'],
    hintPhrase: 'happy new year',
    sceneId: NewYearScene.Confetti,
  },
};

export default newYear;
