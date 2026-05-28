import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { FilesI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { DialGhostIconButton } from '@epam/ai-dial-ui-kit';

interface HiddenItemsTogglerProps {
  onClick: () => void;
  areItemsVisible: boolean;
  className?: string;
  dataQa?: string;
}

export const HiddenItemsToggler = ({
  onClick,
  areItemsVisible,
  className,
  dataQa = 'show-hidden-folders',
}: HiddenItemsTogglerProps) => {
  const { t } = useTranslation(Translation.Files);

  const [Icon, tooltip] = useMemo(
    () =>
      areItemsVisible
        ? [IconEyeOff, FilesI18nKeys.HideTechnicalItems]
        : [IconEye, FilesI18nKeys.ShowTechnicalItems],
    [areItemsVisible],
  );

  return (
    <DialGhostIconButton
      onClick={onClick}
      data-qa={dataQa}
      tooltipProps={{ tooltip: t(tooltip), isTriggerClickable: true }}
      className={className}
      icon={
        <Icon
          height={DEFAULT_ICON_SIZES.STANDARD}
          width={DEFAULT_ICON_SIZES.STANDARD}
        />
      }
    />
  );
};
