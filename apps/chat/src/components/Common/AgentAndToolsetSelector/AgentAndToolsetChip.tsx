import { IconX } from '@tabler/icons-react';
import React from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getEntityNameFromId, getVersionFromId } from '@/src/utils/server/api';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import { Tooltip } from '@/src/components/Common/Tooltip';
import { TopicsList } from '@/src/components/Marketplace/TopicsList';

interface AgentAndToolsetChipProps {
  id: string;
  item?: MarketplaceEntity;
  onRemove: (id: string) => void;
  readonly?: boolean;
}

export const AgentAndToolsetChip: React.FC<AgentAndToolsetChipProps> = ({
  id,
  item,
  onRemove,
  readonly,
}) => {
  const { t } = useTranslation(Translation.Common);
  const isInvalid = !item;

  const name = isInvalid ? getEntityNameFromId(id) : item.name;
  const version = isInvalid ? getVersionFromId(id) : item.version;

  const chipContent = (
    <div
      className={classNames(
        'flex h-[34px] cursor-pointer items-center gap-2 rounded px-2 py-1.5',
        isInvalid
          ? 'bg-error text-error'
          : 'bg-accent-primary-alpha text-primary',
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
            onRemove(id);
          }}
        >
          <IconX size={14} />
        </button>
      )}
    </div>
  );

  return (
    <Tooltip
      isTriggerClickable
      tooltip={
        <div className="flex w-[440px] max-w-full flex-col gap-3 p-3">
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <ModelIcon entityId={id} entity={item} size={96} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs text-secondary">
                {t('Version {{version}}', { version })}
              </span>
              <span className="w-full truncate text-base font-bold">
                {name}
              </span>
              {isInvalid ? (
                <div className="flex items-center gap-2 text-error">
                  <span className="text-sm">
                    {t(
                      'Not available toolset selected. Please, change or remove toolset to proceed',
                    )}
                  </span>
                </div>
              ) : (
                item.description && (
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
      }
    >
      {chipContent}
    </Tooltip>
  );
};
