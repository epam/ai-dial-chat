import { IconPlayerPlay } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { IconNonModelWithTooltip } from '../IconNonModelWithTooltip';

interface Props {
  isCustomTooltip?: boolean;
  size?: number;
}

export const PlaybackIcon = ({ isCustomTooltip, size }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <IconNonModelWithTooltip
      icon={<IconPlayerPlay size={size} />}
      tooltipContent={t('chat.playback.button.playback.label"')}
      isCustomTooltip={isCustomTooltip}
    />
  );
};
