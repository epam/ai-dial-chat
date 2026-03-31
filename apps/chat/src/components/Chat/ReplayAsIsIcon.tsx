import { IconRefreshDot } from '@tabler/icons-react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

import {
  ICON_TO_CONTAINER_RATIO_DENOMINATOR,
  ICON_TO_CONTAINER_RATIO_NUMERATOR,
} from '@/src/constants/icons';

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
          tooltipContent={t(ChatI18nKeys.ReplayAsIs)}
          isCustomTooltip={isCustomTooltip}
        />
      </div>
    </span>
  );
};
