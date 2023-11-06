import { IconPlayerPlay } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { IconNonModelWithTooltip } from './IconNonModelWithTooltip';

interface Props {
  isCustomTooltip?: boolean;
  size?: number;
}

export const PlaybackIcon = ({ isCustomTooltip, size }: Props) => {
  const { t } = useTranslation('chat');

  return (
    <IconNonModelWithTooltip
      icon={<IconPlayerPlay size={size} />}
      tooltipContent={t('Playback')}
      isCustomTooltip={isCustomTooltip}
    />
  );
};
