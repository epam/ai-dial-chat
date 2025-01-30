import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { NonModelButton } from '../../Common/NonModelButton';
import { PlaybackIcon } from './PlaybackIcon';

export const PlaybackModelButton = () => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <NonModelButton
      icon={<PlaybackIcon />}
      buttonLabel={t('Playback')}
      isSelected
    />
  );
};
