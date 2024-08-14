import { IconRefreshDot } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { IconNonModelWithTooltip } from './IconNonModelWithTooltip';

interface Props {
  isCustomTooltip?: boolean;
  size?: number;
}

export const ReplayAsIsIcon = ({ isCustomTooltip, size }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <IconNonModelWithTooltip
      icon={<IconRefreshDot size={size} />}
      tooltipContent={t('chat.common.button.replay_as_is.label')}
      isCustomTooltip={isCustomTooltip}
    />
  );
};
