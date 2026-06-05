import { Icon } from '@tabler/icons-react';
import React from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { Tooltip } from './Tooltip';

import { ButtonAppearance, DialPrimaryIconButton } from '@epam/ai-dial-ui-kit';

interface Props {
  name: string;
  dataQa: string;
  disabled?: boolean;
  Icon?: Icon;
  className?: string;
  size?: number;
  onClick?: (e: React.MouseEvent) => void;
}

export const IconButton: React.FC<Props> = ({
  name,
  dataQa,
  disabled,
  Icon,
  className,
  size = 24,
  onClick,
}) => {
  const { t } = useTranslation(Translation.Common);

  return (
    <Tooltip isTriggerClickable tooltip={t(name)}>
      <DialPrimaryIconButton
        appearance={ButtonAppearance.Ghost}
        onClick={onClick}
        disabled={disabled}
        icon={
          Icon && (
            <Icon size={size} width={size} height={size} strokeWidth="1.5" />
          )
        }
        aria-label={name}
        data-qa={dataQa}
        className={className}
      />
    </Tooltip>
  );
};
