import { IconX } from '@tabler/icons-react';
import React from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getEntityNameFromId } from '@/src/utils/app/id';
import { getVersionFromId } from '@/src/utils/server/api';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import { Tooltip } from '@/src/components/Common/Tooltip';
import { TopicsList } from '@/src/components/Marketplace/TopicsList';

interface ChipViewProps {
  id: string;
  item?: MarketplaceEntity;
  name: string;
  version?: string;
  isInvalid: boolean;
  readonly?: boolean;
  onRemove?: (id: string) => void;
}

const ChipView: React.FC<ChipViewProps> = ({
  id,
  item,
  name,
  version,
  isInvalid,
  readonly,
  onRemove,
}) => {
  return (
    <div
      className={classNames(
        'flex h-[34px] items-center gap-2 rounded px-2 py-1.5',
        isInvalid
          ? 'bg-error text-error'
          : 'bg-accent-primary-alpha text-primary',
        readonly ? 'cursor-default' : 'cursor-pointer',
      )}
    >
      <ModelIcon entityId={id} entity={item} size={18} />
      <span className="max-w-[220px] truncate">
        {name} {version}
      </span>
      {!readonly && (
        <button
          className={classNames(
            'text-secondary',
            isInvalid ? 'hover:text-error' : 'hover:text-primary',
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

interface ChipTooltipContentProps {
  id: string;
  item?: MarketplaceEntity;
  name: string;
  version?: string;
  isInvalid: boolean;
}

const ChipTooltipContent: React.FC<ChipTooltipContentProps> = ({
  id,
  item,
  name,
  version,
  isInvalid,
}) => {
  const { t } = useTranslation(Translation.Common);

  return (
    <div className="flex w-[440px] max-w-full flex-col gap-3 p-3">
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <ModelIcon entityId={id} entity={item} size={96} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-secondary">
            {t('Version {{version}}', { version })}
          </span>
          <span className="w-full truncate text-base font-bold">{name}</span>
          {isInvalid ? (
            <div className="flex items-center gap-2 text-error">
              <span className="text-sm">
                {t(
                  'Not available toolset selected. Please, change or remove toolset to proceed',
                )}
              </span>
            </div>
          ) : (
            item?.description && (
              <EntityMarkdownDescription
                className="line-clamp-3 text-sm leading-4 text-secondary"
                isShortDescription
              >
                {item.description}
              </EntityMarkdownDescription>
            )
          )}
        </div>
      </div>
      {item?.topics && item.topics.length > 0 && (
        <div className="shrink-0">
          <TopicsList topics={item.topics} />
        </div>
      )}
    </div>
  );
};

interface AgentAndToolsetChipProps {
  id: string;
  item?: MarketplaceEntity;
  onRemove?: (id: string) => void;
  readonly?: boolean;
}

export const AgentAndToolsetChip: React.FC<AgentAndToolsetChipProps> = ({
  id,
  item,
  onRemove,
  readonly,
}) => {
  const isInvalid = !item;

  const name = isInvalid ? getEntityNameFromId(id) : item.name;
  const version = isInvalid ? getVersionFromId(id) : item.version;

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
        />
      }
    >
      <ChipView
        id={id}
        item={item}
        name={name}
        version={version}
        isInvalid={isInvalid}
        readonly={readonly}
        onRemove={onRemove}
      />
    </Tooltip>
  );
};
