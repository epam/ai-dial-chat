import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { Tooltip } from '@/src/components/Common/Tooltip';

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
        ? [IconEyeOff, 'Hide technical items']
        : [IconEye, 'Show technical items'],
    [areItemsVisible],
  );

  return (
    <DialGhostIconButton
      onClick={onClick}
      data-qa={dataQa}
      className={className}
      icon={
        <Tooltip tooltip={t(tooltip)} isTriggerClickable>
          <Icon
            height={DEFAULT_ICON_SIZES.STANDARD}
            width={DEFAULT_ICON_SIZES.STANDARD}
          />
        </Tooltip>
      }
    />
  );
};
