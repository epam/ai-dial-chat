import { IconRefreshDot } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { IconNonModelWithTooltip } from './IconNonModelWithTooltip';

interface Props {
  isCustomTooltip?: boolean;
  size?: number;
  strokeWidth?: number;
}

export const ReplayAsIsIcon = ({
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
      data-qa="replay-icon"
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
            <IconRefreshDot
              color="black"
              strokeWidth={strokeWidth}
              className="size-full"
              {...props}
            />
          }
          tooltipContent={t('Replay as is')}
          isCustomTooltip={isCustomTooltip}
        />
      </div>
    </span>
  );
};
