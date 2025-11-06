import { IconX } from '@tabler/icons-react';

import classNames from 'classnames';

import { getEntityNameFromId } from '@/src/utils/app/id';
import { getEntityStatus } from '@/src/utils/marketplace';
import { getVersionFromId } from '@/src/utils/server/api';

import { MarketplaceEntity } from '@/src/types/marketplace';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { ChipTooltipContent } from './ChipTooltipContent';

interface ChipViewProps {
  id: string;
  item?: MarketplaceEntity;
  name: string;
  version?: string;
  isError: boolean;
  isInvalid: boolean;
  readonly?: boolean;
  onRemove?: (id: string) => void;
  onItemClick?: (id: string) => void;
}

const ChipView: React.FC<ChipViewProps> = ({
  id,
  item,
  name,
  version,
  isError,
  isInvalid,
  readonly,
  onRemove,
  onItemClick,
}) => {
  const handleClick = () => {
    if (readonly || isInvalid) {
      return;
    }
    onItemClick?.(id);
  };

  return (
    <div
      className={classNames(
        'flex h-[34px] items-center gap-2 rounded px-2 py-1.5',
        isError
          ? 'bg-error text-error'
          : 'bg-accent-primary-alpha text-primary',
        readonly || isInvalid ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
      onClick={handleClick}
    >
      <ModelIcon entityId={id} entity={item} size={18} />
      <div className="flex max-w-[220px] gap-2 truncate">
        <span>{name}</span>
        <span
          className={classNames(
            'truncate',
            isError ? 'text-error brightness-75' : 'text-secondary',
          )}
        >
          {version}
        </span>
      </div>
      {!readonly && (
        <button
          className={classNames(
            'text-secondary',
            isError ? 'hover:text-error' : 'hover:text-primary',
          )}
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.(id);
          }}
        >
          <IconX size={14} />
        </button>
      )}
    </div>
  );
};

interface AgentAndToolsetChipProps {
  id: string;
  item?: MarketplaceEntity;
  onRemove?: (id: string) => void;
  readonly?: boolean;
  onItemClick?: (id: string) => void;
}

export const AgentAndToolsetChip: React.FC<AgentAndToolsetChipProps> = ({
  id,
  item,
  onRemove,
  readonly,
  onItemClick,
}) => {
  const { isInvalid, isLoggedOut, isError } = getEntityStatus(item);

  const name = !item
    ? getEntityNameFromId(id, { removeVersion: true })
    : item.name;
  const version = !item ? getVersionFromId(id) : item.version;

  return (
    <Tooltip
      isTriggerClickable
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
      <ChipView
        id={id}
        item={item}
        name={name}
        version={version}
        isError={isError}
        isInvalid={isInvalid}
        readonly={readonly}
        onRemove={onRemove}
        onItemClick={onItemClick}
      />
    </Tooltip>
  );
};
