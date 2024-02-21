import { MouseEvent, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { OpenAIEntity } from '@/src/types/openai';
import { Translation } from '@/src/types/translation';

import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';

import ChevronDownIcon from '@/public/images/icons/chevron-down.svg';

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

  const { t } = useTranslation(Translation.Settings);

  const onChangeHandler = (e: MouseEvent<HTMLButtonElement>) => {
    onSelect(e.currentTarget.value);
    setIsOpen(false);
  };

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
      {entities.map((entity) => (
        <MenuItem
          key={entity.id}
          className={classNames(
            'max-w-[350px] text-nowrap hover:bg-accent-primary-alpha',
            currentEntity.id === entity.id && 'bg-accent-primary-alpha',
          )}
          item={t(entity.version || entity.id)}
          value={entity.id}
          onClick={onChangeHandler}
          data-model-versions
          data-qa="model-version-option"
        />
      ))}
    </Menu>
  );
};
