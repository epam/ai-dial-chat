import React, { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { dispatchMouseLeaveEvent } from '@/src/utils/app/common';

import { Translation } from '@/src/types/translation';

import MoveLeftIcon from '@/public/images/icons/move-left.svg';
import MoveRightIcon from '@/public/images/icons/move-right.svg';
import { DialButton } from '@epam/ai-dial-ui-kit';

interface Props {
  iconSize: number;
  tooltip: string;
  isOpened: boolean;
  onToggle: () => void;
  dataQa: string;
  rightSide?: boolean;
  isOverlay?: boolean;
  filterIndicator?: boolean;
}

export const ToggleSidebarButton: React.FC<Props> = ({
  iconSize,
  tooltip,
  isOpened,
  onToggle,
  dataQa,
  rightSide = false,
  isOverlay = false,
  filterIndicator = false,
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

  const IconContent = (
    <div className="relative">
      <Icon
        className={classNames(
          'text-secondary hover:text-accent-primary',
          rightSide && 'rotate-180',
        )}
        width={iconSize}
        height={iconSize}
      />
      {filterIndicator && (
        <div className="absolute right-0 top-0 size-[12px] rounded-full bg-accent-primary"></div>
      )}
    </div>
  );
  return (
    <DialButton
      className={classNames(
        'flex h-full shrink-0 items-center justify-center px-3',
        isOverlay ? 'md:px-3' : 'md:px-5',
      )}
      tooltipProps={{ isTriggerClickable: true, tooltip: t(tooltip) }}
      data-qa={dataQa}
      onClick={handleToggle}
      iconBefore={IconContent}
    />
  );
};
