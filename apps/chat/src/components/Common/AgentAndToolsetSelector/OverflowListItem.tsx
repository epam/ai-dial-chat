import React, { useCallback, useState } from 'react';

import classNames from 'classnames';

import { getEntityNameFromId } from '@/src/utils/app/id';
import { isSmallScreen } from '@/src/utils/app/mobile';
import { getEntityStatus } from '@/src/utils/marketplace';
import { getVersionFromId } from '@/src/utils/server/api';

import { MarketplaceEntity } from '@/src/types/marketplace';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { ChipTitle } from './ChipTitle';
import { ChipTooltipContent } from './ChipTooltipContent';

import { DialCloseButton } from '@epam/ai-dial-ui-kit';

interface ListItemContentProps {
  id: string;
  item?: MarketplaceEntity;
  name: string;
  version?: string;
  isInvalid: boolean;
  isError: boolean;
  handleClick: (e: React.MouseEvent) => void;
  handleRemove: (e: React.MouseEvent) => void;
}

const ListItemContent: React.FC<ListItemContentProps> = ({
  id,
  item,
  name,
  version,
  isInvalid,
  isError,
  handleClick,
  handleRemove,
}) => {
  return (
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
        <ModelIcon entityId={id} entity={item} size={18} isCustomTooltip />
        <ChipTitle name={name} version={version} isError={isError} />
      </div>
      <DialCloseButton
        className={classNames('text-secondary', isError && 'hover:text-error')}
        onClose={handleRemove}
        size={18}
      />
    </div>
  );
};

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

  const shouldShowTooltip = !isMobileView || (isMobileView && isInvalid);
  const name = !item
    ? getEntityNameFromId(id, { removeVersion: true })
    : item.name;
  const version = !item ? getVersionFromId(id) : item.version;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isInvalid) {
        if (isMobileView) {
          e.stopPropagation();
          setIsTooltipOpen(true);
        }
        return;
      }

      onItemClick?.(id);
    },
    [id, isInvalid, isMobileView, onItemClick],
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove(id);
    },
    [id, onRemove],
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
          isInSelectionList
        />
      }
    >
      <ListItemContent
        id={id}
        item={item}
        name={name}
        version={version}
        isInvalid={isInvalid}
        isError={isError}
        handleClick={handleClick}
        handleRemove={handleRemove}
      />
    </Tooltip>
  );
};
