import React, { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { dispatchMouseLeaveEvent } from '@/src/utils/app/common';

import { Translation } from '@/src/types/translation';

import MoveLeftIcon from '@/public/images/icons/move-left.svg';
import MoveRightIcon from '@/public/images/icons/move-right.svg';
import { DialGhostIconButton } from '@epam/ai-dial-ui-kit';

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

  const handleToggle = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      dispatchMouseLeaveEvent(e);
      onToggle();
    },
    [onToggle],
  );

  const Icon = isOpened ? MoveLeftIcon : MoveRightIcon;

  return (
    <DialGhostIconButton
      tooltipProps={{ isTriggerClickable: true, tooltip: t(tooltip) }}
      className={isOverlay ? 'md:px-3' : 'md:px-5'}
      data-qa={dataQa}
      onClick={handleToggle}
      icon={
        <Icon
          className={rightSide && 'rotate-180'}
          width={iconSize}
          height={iconSize}
        />
      }
    />
  );
};
