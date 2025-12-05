import { IconX } from '@tabler/icons-react';

import classNames from 'classnames';

import { isDialAiEntityModel } from '@/src/utils/app/application';
import { getEntityNameFromId } from '@/src/utils/app/id';
import { getEntityStatus } from '@/src/utils/marketplace';
import { getVersionFromId } from '@/src/utils/server/api';

import { ApplicationStatus } from '@/src/types/applications';
import { MarketplaceEntity } from '@/src/types/marketplace';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { ChipTitle } from './ChipTitle';
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
      <ModelIcon entityId={id} entity={item} size={18} isCustomTooltip />
      <ChipTitle
        name={name}
        version={version}
        isError={isError}
        className="max-w-[220px]"
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
  customTooltip?: string;
}

export const AgentAndToolsetChip: React.FC<AgentAndToolsetChipProps> = ({
  id,
  item,
  onRemove,
  readonly,
  onItemClick,
  isInSelectionList,
  customTooltip,
}) => {
  const { isInvalid, isLoggedOut } = getEntityStatus(item);

  const name = !item
    ? getEntityNameFromId(id, { removeVersion: true })
    : item.name;
  const version = !item ? getVersionFromId(id) : item.version;

  const hasError =
    isLoggedOut ||
    !!(
      item &&
      isDialAiEntityModel(item) &&
      item.functionStatus !== ApplicationStatus.DEPLOYED
    );

  return (
    <ChipWrapper isError={hasError}>
      <Tooltip
        isTriggerClickable
        tooltip={
          <>
            {customTooltip && <div className="px-2 pt-1">{customTooltip}</div>}
            <ChipTooltipContent
              id={id}
              item={item}
              name={name}
              version={version}
              isInvalid={isInvalid}
              isLoggedOut={isLoggedOut}
              isInSelectionList={isInSelectionList}
              hideStatusMessage={readonly}
            />
          </>
        }
      >
        <ChipBody
          id={id}
          item={item}
          name={name}
          version={version}
          isError={hasError}
          isInvalid={isInvalid}
          readonly={readonly}
          onClick={onItemClick}
        />
      </Tooltip>

      {!readonly && (
        <ChipRemoveButton id={id} isError={hasError} onRemove={onRemove} />
      )}
    </ChipWrapper>
  );
};
