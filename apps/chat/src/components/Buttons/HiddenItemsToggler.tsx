import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { useMemo } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { Tooltip } from '@/src/components/Common/Tooltip';

import { DialButton } from '@epam/ai-dial-ui-kit';

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
    <DialButton
      onClick={onClick}
      className={classNames(
        'size-[34px] min-h-[34px] min-w-[34px] justify-center p-0 text-secondary hover:bg-accent-primary-alpha  hover:text-accent-primary',
        className,
      )}
      data-qa={dataQa}
      iconBefore={
        <Tooltip tooltip={t(tooltip)} isTriggerClickable>
          <Icon height={24} width={24} />
        </Tooltip>
      }
    />
  );
};
