import { IconSettings } from '@tabler/icons-react';
import React, { useMemo } from 'react';

import classNames from 'classnames';

import { isDialAiEntityModel } from '@/src/utils/app/application';
import {
  getEntityNameFromId,
  isApplicationId,
  isToolsetId,
} from '@/src/utils/app/id';
import { doesAgentSupportMcp } from '@/src/utils/app/models';
import { getEntityStatus } from '@/src/utils/marketplace';
import { getVersionFromId } from '@/src/utils/server/api';

import { MarketplaceEntity } from '@/src/types/marketplace';

import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { CloseButtonSmall } from '@/src/components/Common/CloseButtons';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { ChipTitle } from './ChipTitle';
import { ChipTooltipContent } from './ChipTooltipContent';

import {
  ButtonVariant,
  DialGhostIconButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';

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
    data-qa="agent-chip"
    className={classNames(
      'group relative flex h-[34px] items-center rounded',
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
      variant={isError ? ButtonVariant.Error : ButtonVariant.Primary}
    />
  );
};

interface ChipConfigureButtonProps {
  item?: MarketplaceEntity;
  onConfigure?: (item: MarketplaceEntity) => void;
}

const ChipConfigureButton: React.FC<ChipConfigureButtonProps> = ({
  item,
  onConfigure,
}) => {
  const isConfigurableApp =
    item && isDialAiEntityModel(item) && doesAgentSupportMcp(item);

  const handleClick = () => {
    if (item) onConfigure?.(item);
  };

  if (!isConfigurableApp) return null;

  return (
    <DialGhostIconButton
      name="Configure"
      icon={<IconSettings size={DEFAULT_ICON_SIZES.SMALL} stroke={1.5} />}
      size={ElementSize.Small}
      className="invisible absolute right-[30px] top-1/2 -translate-y-1/2 group-hover:visible"
      onClick={handleClick}
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

  const isConfigurable =
    !readonly && item && isDialAiEntityModel(item) && doesAgentSupportMcp(item);

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
        className={classNames(
          'max-w-[220px]',
          isConfigurable && 'group-hover:pr-[30px]',
        )}
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
  onConfigure?: (item: MarketplaceEntity) => void;
  isInSelectionList?: boolean;
}

export const AgentAndToolsetChip: React.FC<AgentAndToolsetChipProps> = ({
  id,
  item,
  onRemove,
  readonly,
  onItemClick,
  onConfigure,
  isInSelectionList,
}) => {
  const { isInvalid, isError } = getEntityStatus(item);

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
        isInSelectionList={isInSelectionList}
        isCustomTool={isCustomTool}
        readonly={readonly}
      />
    );
  }, [id, item, name, version, isInSelectionList, readonly, isCustomTool]);

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
        <ChipConfigureButton item={item} onConfigure={onConfigure} />
      )}

      {!readonly && (
        <ChipRemoveButton id={id} isError={isError} onRemove={onRemove} />
      )}
    </ChipWrapper>
  );
};
