import { useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { DialAIEntity, DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';

import { ModelIcon } from '../Chatbar/ModelIcon';

import ChevronDownIcon from '@/public/images/icons/chevron-down.svg';
import orderBy from 'lodash-es/orderBy';

const VersionPrefix = () => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex items-center gap-2">
      <span className="hidden md:block">{t('version: ')}</span>
      <span className="md:hidden">{t('v: ')}</span>
    </div>
  );
};

interface ModelVersionSelectProps {
  entities: DialAIEntityModel[];
  currentEntity: DialAIEntity;
  onSelect: (id: DialAIEntityModel) => void;
  className?: string;
  showVersionPrefix?: boolean;
}

export const ModelVersionSelect = ({
  currentEntity,
  entities,
  onSelect,
  className,
  showVersionPrefix = false,
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
    if (entities.length && entities[0].version) {
      return (
        <p className="flex gap-2 truncate" data-qa="version">
          {showVersionPrefix && <VersionPrefix />}
          {entities[0].version}
        </p>
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
      listClassName="z-[60]"
      data-qa="model-version-select"
      trigger={
        <div
          className="flex items-center justify-between gap-2"
          data-qa="model-version-select-trigger"
          data-model-versions
        >
          {showVersionPrefix && <VersionPrefix />}
          <span className="truncate" data-qa="version">
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
