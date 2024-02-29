import { MouseEvent, useMemo, useState } from 'react';

import classNames from 'classnames';

import { OpenAIEntity } from '@/src/types/openai';

import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';

import { ModelIcon } from '../Chatbar/ModelIcon';

import ChevronDownIcon from '@/public/images/icons/chevron-down.svg';
import orderBy from 'lodash-es/orderBy';

interface ModelVersionSelectProps {
  entities: OpenAIEntity[];
  currentEntity: OpenAIEntity;
  onSelect: (id: string) => void;
}

export const ModelVersionSelect = ({
  currentEntity,
  entities,
  onSelect,
}: ModelVersionSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const onChangeHandler = (e: MouseEvent<HTMLButtonElement>) => {
    onSelect(e.currentTarget.value);
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
      type="contextMenu"
      placement="bottom-end"
      onOpenChange={setIsOpen}
      data-qa="model-version-select"
      trigger={
        <div
          className="flex items-center justify-between gap-2"
          data-qa="model-version-select-trigger"
          data-model-versions
        >
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
          onClick={onChangeHandler}
          data-model-versions
          data-qa="model-version-option"
        />
      ))}
    </Menu>
  );
};
