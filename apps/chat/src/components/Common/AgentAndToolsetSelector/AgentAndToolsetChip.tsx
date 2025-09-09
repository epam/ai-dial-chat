import { IconX } from '@tabler/icons-react';
import React from 'react';

import classNames from 'classnames';

import { MarketplaceEntity } from '@/src/types/marketplace';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import { Tooltip } from '@/src/components/Common/Tooltip';
import { TopicsList } from '@/src/components/Marketplace/TopicsList';

const AgentTooltipContent = ({ item }: { item: MarketplaceEntity }) => {
  return (
    <div className="flex max-h-[166px] w-full max-w-[440px] flex-col gap-3 p-3">
      <div className="flex min-h-0 items-center gap-3">
        <div className="shrink-0">
          <ModelIcon entityId={item.id} entity={item} size={96} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-base font-bold">{item.name}</span>
          {item.description && (
            <EntityMarkdownDescription
              className="line-clamp-3 text-sm leading-4 text-secondary"
              isShortDescription
            >
              {item.description}
            </EntityMarkdownDescription>
          )}
        </div>
      </div>

      {item.topics && item.topics.length > 0 && (
        <div className="shrink-0">
          <TopicsList topics={item.topics} />
        </div>
      )}
    </div>
  );
};

interface AgentAndToolsetChipProps {
  item: MarketplaceEntity;
  readonly?: boolean;
  onRemove?: (id: string) => void;
}
export const AgentAndToolsetChip: React.FC<AgentAndToolsetChipProps> = ({
  item,
  readonly,
  onRemove,
}) => {
  return (
    <Tooltip
      isTriggerClickable
      triggerClassName={classNames(
        'flex h-[34px] items-center gap-2 rounded bg-accent-primary-alpha px-2 py-1.5 text-primary',
        readonly ? 'cursor-default' : 'cursor-pointer',
      )}
      tooltip={<AgentTooltipContent item={item} />}
    >
      <ModelIcon entityId={item.id} entity={item} size={18} />
      <span className="max-w-[200px] truncate">{item.name}</span>
      {!readonly && (
        <button
          className="text-secondary hover:text-primary"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.(item.id);
          }}
        >
          <IconX size={14} />
        </button>
      )}
    </Tooltip>
  );
};
