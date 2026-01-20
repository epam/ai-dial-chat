import { useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { stopBubbling } from '@/src/constants/chat';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';
import { Tooltip } from '@/src/components/Common/Tooltip';

import ChevronDownIcon from '@/public/images/icons/chevron-down.svg';

const VersionPrefix = () => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="mr-2 flex items-center">
      <span className="hidden md:block">{t('Version: ')}</span>
      <span className="md:hidden">{t('v. ')}</span>
    </div>
  );
};

const getDisplayValue = <T extends MarketplaceEntity>(entity: T) =>
  entity.version || entity.id;

interface EntityVersionSelectProps<T extends MarketplaceEntity> {
  entities: T[];
  currentEntity: T;
  className?: string;
  showVersionPrefix?: boolean;
  readonly?: boolean;
  onSelect: (entity: T) => void;
  triggerClassName?: string;
  selectedBaseIdsSet?: Set<string>;
}

export const ModelVersionSelect = <T extends MarketplaceEntity>({
  entities,
  currentEntity,
  className,
  showVersionPrefix = false,
  readonly = false,
  onSelect,
  triggerClassName,
  selectedBaseIdsSet,
}: EntityVersionSelectProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (entity: T) => {
    onSelect(entity);
    setIsOpen(false);
  };

  if (entities.length < 2) {
    if (entities.length && entities[0].version) {
      return (
        <div
          className={classNames('flex truncate font-theme text-sm', className)}
        >
          {showVersionPrefix && <VersionPrefix />}
          <span
            className="max-w-full overflow-hidden truncate whitespace-nowrap"
            data-qa="version"
          >
            {entities[0].version}
          </span>
        </div>
      );
    }

    return null;
  }

  return (
    <Menu
      className={className}
      type="contextMenu"
      placement="bottom-end"
      onOpenChange={setIsOpen}
      listClassName="z-[2000]"
      data-qa="model-version-select"
      trigger={
        <div
          className={classNames(
            'flex cursor-pointer items-center justify-between font-theme text-sm',
            triggerClassName,
          )}
          data-qa="agent-version-select-trigger"
          data-model-versions
          onClick={stopBubbling}
        >
          {showVersionPrefix && <VersionPrefix />}
          <span
            className="max-w-full overflow-hidden truncate whitespace-nowrap"
            data-qa="version"
          >
            {getDisplayValue(currentEntity)}
          </span>
          <ChevronDownIcon
            className={classNames(
              'ml-1 shrink-0 text-primary transition-all',
              isOpen && 'rotate-180',
            )}
            width={18}
            height={18}
          />
        </div>
      }
    >
      {entities.map((entity) => (
        <MenuItem
          key={entity.id}
          className={classNames(
            'max-w-[350px] overflow-hidden text-nowrap hover:bg-accent-primary-alpha',
            (currentEntity.id === entity.id ||
              selectedBaseIdsSet?.has(entity.id)) &&
              'bg-accent-primary-alpha',
          )}
          item={
            <div className="flex w-full items-center gap-2">
              <ModelIcon entityId={entity.id} entity={entity} size={16} />
              <Tooltip
                tooltip={getDisplayValue(entity)}
                triggerClassName="truncate"
              >
                {getDisplayValue(entity)}
              </Tooltip>
            </div>
          }
          disabled={readonly}
          value={entity.id}
          onClick={(e) => {
            e.stopPropagation();
            handleChange(entity);
          }}
          data-model-versions
          data-qa="model-version-option"
        />
      ))}
    </Menu>
  );
};
