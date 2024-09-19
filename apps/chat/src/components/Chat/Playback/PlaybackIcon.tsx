import { IconPlayerPlay } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { IconNonModelWithTooltip } from '../IconNonModelWithTooltip';

interface Props {
  isCustomTooltip?: boolean;
  size?: number;
  strokeWidth?: number;
}

export const PlaybackIcon = ({ isCustomTooltip, ...props }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <IconNonModelWithTooltip
      icon={<IconPlayerPlay {...props} />}
      tooltipContent={t('Playback')}
      isCustomTooltip={isCustomTooltip}
    />
  );
};
