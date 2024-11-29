import { IconPlayerPlay } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { IconNonModelWithTooltip } from '../IconNonModelWithTooltip';

interface Props {
  isCustomTooltip?: boolean;
  size?: number;
  strokeWidth?: number;
}

export const PlaybackIcon = ({
  isCustomTooltip,
  size = 24,
  strokeWidth = 1,
  ...props
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const innerSize = (size * 7) / 8;

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-model-icon"
      style={{
        height: `${size}px`,
        width: `${size}px`,
      }}
    >
      <div
        style={{
          height: `${innerSize}px`,
          width: `${innerSize}px`,
        }}
      >
        <IconNonModelWithTooltip
          icon={
            <IconPlayerPlay
              color="black"
              strokeWidth={strokeWidth}
              className="size-full"
              {...props}
            />
          }
          tooltipContent={t('Playback')}
          isCustomTooltip={isCustomTooltip}
        />
      </div>
    </span>
  );
};
