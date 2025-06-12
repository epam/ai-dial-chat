import { Icon } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

import { Tooltip } from './Tooltip';

interface Props {
  name: string;
  dataQa: string;
  disabled?: boolean;
  Icon?: Icon;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export const IconButton: React.FC<Props> = ({
  name,
  dataQa,
  disabled,
  Icon,
  onClick,
  className,
}) => {
  const { t } = useTranslation(Translation.Common);

  return (
    <Tooltip isTriggerClickable tooltip={t(name)}>
      <button
        disabled={disabled}
        onClick={onClick}
        className={classNames('icon-button', className)}
        data-qa={dataQa}
      >
        {Icon && <Icon className="size-6" strokeWidth="1.5" />}
      </button>
    </Tooltip>
  );
};
