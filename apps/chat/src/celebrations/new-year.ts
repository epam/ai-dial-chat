import type { CelebrationEvent } from '@epam/ai-dial-celebrations';
import iconUrl from '../assets/new-year-logo.svg?no-inline';
import NewYearDecor from '../components/NewYear/NewYearDecor';
import {
  NewYearConfetti,
  NewYearSnow,
} from '../components/NewYear/NewYearParticles';
import NewYearSleigh from '../components/NewYear/NewYearSleigh';
import { NewYearScene } from '../components/NewYear/types';
import { NewYearI18nKeys } from '../constants/translation-keys';

/* Label ids are the i18n key suffixes; the host adapter supplies the text. */
const labelId = (key: NewYearI18nKeys) => key.replace('newYear.', '');

const newYear: CelebrationEvent = {
  id: 'new-year',
  iconUrl,
  Decoration: NewYearDecor,
  scenes: [
    {
      id: NewYearScene.Snow,
      Component: NewYearSnow,
      durationMs: 12000,
      labelId: labelId(NewYearI18nKeys.SnowToastMessage),
    },
    {
      id: NewYearScene.Confetti,
      Component: NewYearConfetti,
      durationMs: 9000,
      labelId: labelId(NewYearI18nKeys.ConfettiToastMessage),
    },
    {
      id: NewYearScene.Sleigh,
      Component: NewYearSleigh,
      durationMs: 12000,
      labelId: labelId(NewYearI18nKeys.SleighToastMessage),
    },
  ],
  clickSceneIds: Object.values(NewYearScene),
  labels: {},
  titleLabelId: labelId(NewYearI18nKeys.ToastTitle),
  secretTrigger: {
    phrases: ['happy new year'],
    hintPhrase: 'happy new year',
    sceneIds: [NewYearScene.Confetti],
  },
};

export default newYear;
