import React from 'react';

import { useTranslation } from 'next-i18next';

import { dispatchMouseLeaveEvent } from '@/src/utils/app/common';

import { Translation } from '@/src/types/translation';

import Tooltip from '@/src/components/Common/Tooltip';

import MoveLeftIcon from '@/public/images/icons/move-left.svg';
import MoveRightIcon from '@/public/images/icons/move-right.svg';

interface Props {
  iconSize: number;
  tooltip: string;
  isOpened: boolean;
  onToggle: () => void;
  dataQa: string;
}

export const ToggleSidebarButton: React.FC<Props> = ({
  iconSize,
  tooltip,
  isOpened,
  onToggle,
  dataQa,
}) => {
  const { t } = useTranslation(Translation.Header);

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    dispatchMouseLeaveEvent(e);
    onToggle();
  };

  return (
    <Tooltip isTriggerClickable tooltip={t(tooltip)}>
      <button
        className="flex h-full items-center justify-center border-r border-tertiary px-3 md:px-5"
        data-qa={dataQa}
        onClick={handleToggle}
      >
        {isOpened ? (
          <MoveLeftIcon
            className="text-secondary hover:text-accent-primary"
            width={iconSize}
            height={iconSize}
          />
        ) : (
          <MoveRightIcon
            className="text-secondary hover:text-accent-primary"
            width={iconSize}
            height={iconSize}
          />
        )}
      </button>
    </Tooltip>
  );
};
