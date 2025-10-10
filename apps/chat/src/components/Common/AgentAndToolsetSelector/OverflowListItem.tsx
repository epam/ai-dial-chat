import { IconX } from '@tabler/icons-react';
import React, { useState } from 'react';

import classNames from 'classnames';

import { getEntityNameFromId } from '@/src/utils/app/id';
import { isSmallScreen } from '@/src/utils/app/mobile';
import { getEntityStatus } from '@/src/utils/marketplace';
import { getVersionFromId } from '@/src/utils/server/api';

import { MarketplaceEntity } from '@/src/types/marketplace';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { ChipTooltipContent } from './ChipTooltipContent';

interface OverflowListItemProps {
  id: string;
  item?: MarketplaceEntity;
  onRemove: (id: string) => void;
  onItemClick?: (id: string) => void;
}

export const OverflowListItem: React.FC<OverflowListItemProps> = ({
  id,
  item,
  onRemove,
  onItemClick,
}) => {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  const isMobileView = isSmallScreen();

  const { isInvalid, isLoggedOut, isError } = getEntityStatus(item);

  const name = !item
    ? getEntityNameFromId(id, { removeVersion: true })
    : item.name;
  const version = !item ? getVersionFromId(id) : item.version;

  const handleClick = (e: React.MouseEvent) => {
    if (isInvalid) {
      if (isMobileView) {
        e.stopPropagation();
        setIsTooltipOpen(true);
      }
      return;
    }

    onItemClick?.(id);
  };

  const shouldShowTooltip = !isMobileView || (isMobileView && isInvalid);

  const ListItemContent = (
    <div
      className={classNames(
        'flex w-full items-center justify-between gap-3 px-3 py-2 transition-colors',
        {
          'cursor-pointer': !isInvalid,
          'cursor-not-allowed': isInvalid,
          'hover:bg-error': isError,
          'hover:bg-accent-primary-alpha': !isError,
        },
      )}
      onClick={handleClick}
    >
      <div className="flex min-w-0 items-center gap-2">
        <ModelIcon entityId={id} entity={item} size={18} />
        <div className="flex gap-2 truncate">
          <span className={classNames('shrink-0', { 'text-error': isError })}>
            {name}
          </span>
          <span
            className={classNames(
              'truncate',
              isError ? 'text-error brightness-75' : 'text-secondary',
            )}
          >
            {version}
          </span>
        </div>
      </div>
      <button
        className="shrink-0 text-secondary hover:text-primary"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(id);
        }}
      >
        <IconX size={18} />
      </button>
    </div>
  );

  return (
    <Tooltip
      placement="left"
      isTriggerClickable={isMobileView}
      hideTooltip={!shouldShowTooltip}
      open={isMobileView ? isTooltipOpen : undefined}
      onOpenChange={isMobileView ? setIsTooltipOpen : undefined}
      tooltip={
        <ChipTooltipContent
          id={id}
          item={item}
          name={name}
          version={version}
          isInvalid={isInvalid}
          isLoggedOut={isLoggedOut}
        />
      }
    >
      {ListItemContent}
    </Tooltip>
  );
};
