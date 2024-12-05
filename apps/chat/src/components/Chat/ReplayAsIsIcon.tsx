import { IconRefreshDot } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { IconNonModelWithTooltip } from './IconNonModelWithTooltip';

interface Props {
  isCustomTooltip?: boolean;
  size?: number;
  strokeWidth?: number;
}

const ICON_TO_CONTAINER_RATIO_NUMERATOR = 7;
const ICON_TO_CONTAINER_RATIO_DENOMINATOR = 8;

export const ReplayAsIsIcon = ({
  isCustomTooltip,
  size = 24,
  strokeWidth = 1,
  ...props
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const innerSize =
    (size * ICON_TO_CONTAINER_RATIO_NUMERATOR) /
    ICON_TO_CONTAINER_RATIO_DENOMINATOR;

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
