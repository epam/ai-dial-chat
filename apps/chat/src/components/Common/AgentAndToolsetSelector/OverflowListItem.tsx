import { IconX } from '@tabler/icons-react';
import React from 'react';

import classNames from 'classnames';

import { getEntityNameFromId } from '@/src/utils/app/id';
import { getVersionFromId } from '@/src/utils/server/api';

import { MarketplaceEntity } from '@/src/types/marketplace';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';

interface OverflowListItemProps {
  id: string;
  item?: MarketplaceEntity;
  onRemove: (id: string) => void;
}

export const OverflowListItem: React.FC<OverflowListItemProps> = ({
  id,
  item,
  onRemove,
}) => {
  const isInvalid = !item;
  const name = isInvalid
    ? getEntityNameFromId(id, { removeVersion: true })
    : item.name;
  const version = isInvalid ? getVersionFromId(id) : item.version;

  return (
    <div className="flex w-full items-center justify-between gap-3 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <ModelIcon entityId={id} entity={item} size={18} />

        <div className="flex gap-2 truncate">
          <span className="shrink-0">{name}</span>
          <span
            className={classNames(
              'truncate text-secondary',

              { 'text-error': isInvalid },
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
};
