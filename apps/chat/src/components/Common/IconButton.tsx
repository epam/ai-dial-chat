import { Icon } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

import { Tooltip } from './Tooltip';

import { DialButton } from '@epam/ai-dial-ui-kit';

interface Props {
  name: string;
  dataQa: string;
  disabled?: boolean;
  Icon?: Icon;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export const IconButton: React.FC<Props> = ({
  name,
  dataQa,
  disabled,
  Icon,
  className,
  onClick,
}) => {
  const { t } = useTranslation(Translation.Common);

  return (
    <Tooltip isTriggerClickable tooltip={t(name)}>
      <DialButton
        onClick={onClick}
        disabled={disabled}
        iconBefore={Icon && <Icon className="size-6" strokeWidth="1.5" />}
        data-qa={dataQa}
        className={classNames('icon-button', className)}
      />
    </Tooltip>
  );
};
