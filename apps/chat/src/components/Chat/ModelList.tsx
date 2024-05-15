import { IconChevronDown } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import classNames from 'classnames';

import {
  getOpenAIEntityFullName,
  groupModelsAndSaveOrder,
} from '@/src/utils/app/conversation';
import { hasParentWithAttribute } from '@/src/utils/app/modals';
import { doesOpenAIEntityContainSearchTerm } from '@/src/utils/app/search';

import { DialAIEntity } from '@/src/types/models';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { ModelIcon } from '../Chatbar/ModelIcon';
import { DisableOverlay } from '../Common/DisableOverlay';
import { EntityMarkdownDescription } from '../Common/MarkdownDescription';
import { ModelVersionSelect } from './ModelVersionSelect';

interface ModelGroupProps {
  entities: DialAIEntity[];
  selectedModelId: string | undefined;
  onSelect: (id: string) => void;
  notAllowExpandDescription?: boolean;
  searchTerm?: string;
  disabled?: boolean;
  isReplayAsIs?: boolean;
}

const ModelGroup = ({
  entities,
  selectedModelId,
  onSelect,
  notAllowExpandDescription,
  searchTerm,
  disabled,
  isReplayAsIs,
}: ModelGroupProps) => {
  const [isOpened, setIsOpened] = useState(false);
  const recentModelsIds = useAppSelector(ModelsSelectors.selectRecentModelsIds);

  const currentEntity = useMemo(() => {
    // if only 1 model without group
    if (entities.length < 2) {
      return entities[0];
    }
    // searched
    const searched = searchTerm
      ? entities.find((e) => doesOpenAIEntityContainSearchTerm(e, searchTerm))
      : undefined;
    if (searched) {
      return searched;
    }
    // selected
    const selected = entities.find((e) => e.id === selectedModelId);
    if (selected) {
      return selected;
    }
    // find latest used version
    const minIndex = Math.min(
      ...recentModelsIds
        .map((rid) => entities.findIndex((e) => e.id === rid))
        .filter((ind) => ind !== -1),
      Number.MAX_SAFE_INTEGER,
    );
    return entities[minIndex === Number.MAX_SAFE_INTEGER ? 0 : minIndex];
  }, [entities, recentModelsIds, searchTerm, selectedModelId]);

  const description = currentEntity.description;
  const isActive =
    !disabled && !isReplayAsIs && selectedModelId === currentEntity.id;

  return (
    <div
      className={classNames(
        'relative rounded border',
        isActive
          ? 'border-accent-primary'
          : 'border-primary hover:border-hover',
        isOpened ? 'md:col-span-2' : 'md:col-span-1',
        !disabled ? 'cursor-pointer' : 'cursor-not-allowed',
      )}
      onClick={(e) => {
        if (disabled) {
          return;
        }
        if (
          !hasParentWithAttribute(
            e.target as HTMLAnchorElement,
            'data-model-versions',
          )
        ) {
          onSelect(currentEntity.id);
        }
      }}
      data-qa="group-entity"
    >
      {disabled && <DisableOverlay />}
      <div className="flex h-full items-center gap-3 px-3 py-2">
        <ModelIcon
          entityId={currentEntity.id}
          entity={currentEntity}
          size={24}
          isSmallIconSize={false}
        />
        <div className="flex w-full flex-col gap-1 text-left">
          <div className="flex items-center justify-between">
            <span data-qa="group-entity-name" className="whitespace-pre">
              {entities.length === 1
                ? getOpenAIEntityFullName(currentEntity)
                : currentEntity.name}
            </span>
            <ModelVersionSelect
              entities={entities}
              onSelect={onSelect}
              currentEntity={currentEntity}
            />
          </div>
          {description && (
            <span
              className="text-secondary-bg-light"
              onClick={(e) => {
                if ((e.target as HTMLAnchorElement)?.tagName === 'A') {
                  e.stopPropagation();
                }
              }}
              data-qa="group-entity-descr"
            >
              <EntityMarkdownDescription isShortDescription={!isOpened}>
                {description}
              </EntityMarkdownDescription>
            </span>
          )}
        </div>
        {!notAllowExpandDescription &&
          description &&
          description.indexOf('\n\n') !== -1 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpened((isOpened) => !isOpened);
              }}
              data-qa="expand-group-entity"
            >
              <IconChevronDown
                size={18}
                className={classNames(
                  'transition-all',
                  isOpened && 'rotate-180',
                )}
              />
            </button>
          )}
      </div>
    </div>
  );
};

interface ModelListProps {
  entities: DialAIEntity[];
  heading?: string;
  selectedModelId: string | undefined;
  onSelect: (entityId: string) => void;
  notAllowExpandDescription?: boolean;
  displayCountLimit?: number;
  showInOneColumn?: boolean;
  allEntities: DialAIEntity[];
  searchTerm?: string;
  disabled?: boolean;
  isReplayAsIs?: boolean;
}

export const ModelList = ({
  entities,
  heading,
  selectedModelId,
  onSelect,
  notAllowExpandDescription,
  displayCountLimit,
  showInOneColumn,
  allEntities,
  searchTerm,
  disabled,
  isReplayAsIs,
}: ModelListProps) => {
  const groupedModels = useMemo(() => {
    const nameSet = new Set(entities.map((m) => m.name));
    const otherVersions = allEntities.filter((m) => nameSet.has(m.name));
    return groupModelsAndSaveOrder(entities.concat(otherVersions)).slice(
      0,
      displayCountLimit ?? Number.MAX_SAFE_INTEGER,
    );
  }, [allEntities, displayCountLimit, entities]);
  return (
    <div className="flex flex-col gap-3 text-xs" data-qa="talk-to-group">
      {heading && <span className="text-secondary-bg-dark">{heading}</span>}
      <div
        className={classNames(
          'grid min-h-0 shrink grid-cols-1 gap-3 overflow-y-auto',
          !showInOneColumn && 'md:grid-cols-2',
        )}
      >
        {groupedModels.map((modelGroup) => (
          <ModelGroup
            key={modelGroup.groupName}
            entities={modelGroup.entities}
            selectedModelId={selectedModelId}
            onSelect={onSelect}
            notAllowExpandDescription={notAllowExpandDescription}
            disabled={disabled}
            searchTerm={searchTerm}
            isReplayAsIs={isReplayAsIs}
          />
        ))}
      </div>
    </div>
  );
};
