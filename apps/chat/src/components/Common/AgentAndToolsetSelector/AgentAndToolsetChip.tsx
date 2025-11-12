import { IconX } from '@tabler/icons-react';

import classNames from 'classnames';

import { getEntityNameFromId } from '@/src/utils/app/id';
import { getEntityStatus } from '@/src/utils/marketplace';
import { getVersionFromId } from '@/src/utils/server/api';

import { MarketplaceEntity } from '@/src/types/marketplace';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { ChipTooltipContent } from './ChipTooltipContent';

interface ChipWrapperProps {
  isError: boolean;
  children: React.ReactNode;
}

const ChipWrapper: React.FC<ChipWrapperProps> = ({ isError, children }) => (
  <div
    className={classNames(
      'flex h-[34px] items-center rounded',
      isError ? 'bg-error' : 'bg-accent-primary-alpha',
    )}
  >
    {children}
  </div>
);

interface ChipRemoveButtonProps {
  id: string;
  isError: boolean;
  onRemove?: (id: string) => void;
}

const ChipRemoveButton: React.FC<ChipRemoveButtonProps> = ({
  id,
  isError,
  onRemove,
}) => (
  <button
    className={classNames(
      'mr-1 p-1 text-secondary',
      isError ? 'hover:text-error' : 'hover:text-accent-primary',
    )}
    onClick={() => onRemove?.(id)}
    aria-label="Remove item"
  >
    <IconX size={14} />
  </button>
);

interface ChipBodyProps {
  id: string;
  item?: MarketplaceEntity;
  name: string;
  version?: string;
  isError: boolean;
  isInvalid: boolean;
  readonly?: boolean;
  onClick?: (id: string) => void;
}

const ChipBody: React.FC<ChipBodyProps> = ({
  id,
  item,
  name,
  version,
  isError,
  isInvalid,
  readonly,
  onClick,
}) => {
  const handleClick = () => {
    if (readonly || isInvalid) return;
    onClick?.(id);
  };

  return (
    <div
      className={classNames(
        'flex h-full items-center gap-2 py-1.5 pl-2 pr-1',
        isError ? 'text-error' : 'text-primary',
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
    </div>
  );
};

interface AgentAndToolsetChipProps {
  id: string;
  item?: MarketplaceEntity;
  onRemove?: (id: string) => void;
  readonly?: boolean;
  onItemClick?: (id: string) => void;
  isInSelectionList?: boolean;
}

export const AgentAndToolsetChip: React.FC<AgentAndToolsetChipProps> = ({
  id,
  item,
  onRemove,
  readonly,
  onItemClick,
  isInSelectionList,
}) => {
  const { isInvalid, isLoggedOut, isError } = getEntityStatus(item);

  const name = !item
    ? getEntityNameFromId(id, { removeVersion: true })
    : item.name;
  const version = !item ? getVersionFromId(id) : item.version;

  return (
    <ChipWrapper isError={isError}>
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
            isInSelectionList={isInSelectionList}
          />
        }
      >
        <ChipBody
          id={id}
          item={item}
          name={name}
          version={version}
          isError={isError}
          isInvalid={isInvalid}
          readonly={readonly}
          onClick={onItemClick}
        />
      </Tooltip>

      {!readonly && (
        <ChipRemoveButton id={id} isError={isError} onRemove={onRemove} />
      )}
    </ChipWrapper>
  );
};
