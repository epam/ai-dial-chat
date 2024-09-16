import { useMemo, useState } from 'react';

import classNames from 'classnames';

import { DialAIEntity, DialAIEntityModel } from '@/src/types/models';

import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';

import { ModelIcon } from '../Chatbar/ModelIcon';

import ChevronDownIcon from '@/public/images/icons/chevron-down.svg';
import orderBy from 'lodash-es/orderBy';

interface ModelVersionSelectProps {
  entities: DialAIEntityModel[];
  currentEntity: DialAIEntity;
  onSelect: (id: DialAIEntityModel) => void;
  className?: string;
}

export const ModelVersionSelect = ({
  currentEntity,
  entities,
  onSelect,
  className,
}: ModelVersionSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const onChangeHandler = (entity: DialAIEntityModel) => {
    onSelect(entity);
    setIsOpen(false);
  };

  const sortedEntities = useMemo(
    () => orderBy(entities, 'version', 'desc'),
    [entities],
  );

  if (entities.length < 2) {
    return null;
  }

  return (
    <Menu
      className={className}
      type="contextMenu"
      placement="bottom-end"
      onOpenChange={setIsOpen}
      listClassName="z-[60]"
      data-qa="model-version-select"
      trigger={
        <div
          className="flex items-center justify-between gap-2"
          data-qa="model-version-select-trigger"
          data-model-versions
        >
          v.
          <span className="truncate">
            {currentEntity.version || currentEntity.id}
          </span>
          <ChevronDownIcon
            className={classNames(
              'shrink-0 text-primary transition-all',
              isOpen && 'rotate-180',
            )}
            width={18}
            height={18}
          />
        </div>
      }
    >
      {sortedEntities.map((entity) => (
        <MenuItem
          key={entity.id}
          className={classNames(
            'max-w-[350px] text-nowrap hover:bg-accent-primary-alpha',
            currentEntity.id === entity.id && 'bg-accent-primary-alpha',
          )}
          item={
            <div className="flex items-center gap-2">
              <ModelIcon entityId={entity.id} entity={entity} size={16} />
              {entity.version || entity.id}
            </div>
          }
          value={entity.id}
          onClick={() => onChangeHandler(entity)}
          data-model-versions
          data-qa="model-version-option"
        />
      ))}
    </Menu>
  );
};
