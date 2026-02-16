import { useMemo } from 'react';

import classNames from 'classnames';

import {
  getEntityNameFromId,
  isApplicationId,
  isToolsetId,
} from '@/src/utils/app/id';
import { getEntityStatus } from '@/src/utils/marketplace';
import { getVersionFromId } from '@/src/utils/server/api';

import { MarketplaceEntity } from '@/src/types/marketplace';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { CloseButtonSmall } from '@/src/components/Common/CloseButtons';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { ChipTitle } from './ChipTitle';
import { ChipTooltipContent } from './ChipTooltipContent';

interface ChipWrapperProps {
  isError: boolean;
  isCustomTool?: boolean;
  children: React.ReactNode;
}

const ChipWrapper: React.FC<ChipWrapperProps> = ({
  isError,
  isCustomTool,
  children,
}) => (
  <div
    className={classNames(
      'flex h-[34px] items-center rounded',
      isCustomTool
        ? 'bg-layer-4'
        : isError
          ? 'bg-error'
          : 'bg-accent-primary-alpha',
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
}) => {
  const isCustomTool = !isApplicationId(id) && !isToolsetId(id);

  return (
    <CloseButtonSmall
      className={classNames(
        'mr-1',
        isError && !isCustomTool && 'hover:enabled:text-error',
      )}
      onClick={() => onRemove?.(id)}
      aria-label="Remove item"
    />
  );
};

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

  const isCustomTool = !isApplicationId(id) && !isToolsetId(id) && !item;

  return (
    <div
      className={classNames(
        'flex h-full items-center gap-2 py-1.5 pl-2 pr-1',
        isError ? 'text-error' : 'text-primary',
        readonly || isInvalid ? 'cursor-not-allowed' : 'cursor-pointer',
        readonly && 'pr-2',
      )}
      onClick={handleClick}
    >
      <ModelIcon entityId={id} entity={item} size={18} isCustomTooltip />
      <ChipTitle
        name={name}
        version={version}
        isError={isError}
        className="max-w-[220px]"
        isCustomTool={isCustomTool}
      />
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
  const { isInvalid, isLoggedOut, isError, isUndeployed } =
    getEntityStatus(item);

  const name = !item
    ? getEntityNameFromId(id, { removeVersion: true })
    : item.name;
  const isCustomTool = !isApplicationId(id) && !isToolsetId(id) && !item;

  const version = isCustomTool
    ? ''
    : !item
      ? getVersionFromId(id)
      : item.version;

  const tooltipContent = useMemo(() => {
    return (
      <ChipTooltipContent
        id={id}
        item={item}
        name={name}
        version={version}
        isInvalid={isInvalid}
        isLoggedOut={isLoggedOut}
        isUndeployed={isUndeployed}
        isInSelectionList={isInSelectionList}
        isCustomTool={isCustomTool}
        readonly={readonly}
      />
    );
  }, [
    id,
    item,
    name,
    version,
    isInvalid,
    isLoggedOut,
    isUndeployed,
    isInSelectionList,
    readonly,
    isCustomTool,
  ]);

  return (
    <ChipWrapper isError={isError} isCustomTool={isCustomTool}>
      <Tooltip isTriggerClickable tooltip={tooltipContent}>
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
