import React from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

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
  rightSide?: boolean;
  isOverlay?: boolean;
}

export const ToggleSidebarButton: React.FC<Props> = ({
  iconSize,
  tooltip,
  isOpened,
  onToggle,
  dataQa,
  rightSide = false,
  isOverlay = false,
}) => {
  const { t } = useTranslation(Translation.Header);

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    dispatchMouseLeaveEvent(e);
    onToggle();
  };

  const Icon = isOpened ? MoveLeftIcon : MoveRightIcon;

  return (
    <Tooltip isTriggerClickable tooltip={t(tooltip)}>
      <button
        className={classNames(
          'flex h-full items-center justify-center px-3',
          isOverlay ? 'md:px-3' : 'md:px-5',
        )}
        data-qa={dataQa}
        onClick={handleToggle}
      >
        <Icon
          className={classNames(
            'text-secondary hover:text-accent-primary',
            rightSide && 'rotate-180',
          )}
          width={iconSize}
          height={iconSize}
        />
      </button>
    </Tooltip>
  );
};
