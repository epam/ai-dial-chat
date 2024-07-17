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
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ModelId } from '@/src/constants/chat';
import { TourGuideId } from '@/src/constants/share';

import { ModelIcon } from '../Chatbar/ModelIcon';
import { DisableOverlay } from '../Common/DisableOverlay';
import { EntityMarkdownDescription } from '../Common/MarkdownDescription';
import { ModelVersionSelect } from './ModelVersionSelect';

import { DallIcon } from '@/src/icons';

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
  const isCompareMode = useAppSelector(UISelectors.selectIsCompareMode);
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
        'relative flex overflow-y-auto rounded-primary border font-medium hover:border-tertiary',
        isActive
          ? 'border-accent-quaternary bg-accent-secondary-alpha shadow-primary'
          : 'border-secondary bg-layer-2 hover:bg-accent-secondary-alpha hover:shadow-primary',
        isOpened ? 'md:col-span-2' : 'md:col-span-1',
        isCompareMode ? 'px-3 py-2' : 'px-5 py-2',
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
      <div className="flex min-h-[48px] items-center gap-3 border-secondary ">
        {currentEntity.id === ModelId.DALL ? (
          <DallIcon />
        ) : (
          <ModelIcon
            entityId={currentEntity.id}
            entity={currentEntity}
            size={24}
            isSmallIconSize={false}
          />
        )}
        <div className="flex w-full flex-col gap-0.5 text-left">
          <div className="flex items-center justify-between font-medium">
            <span data-qa="group-entity-name">
              {entities.length === 1
                ? getOpenAIEntityFullName(currentEntity)
                : currentEntity.name}
            </span>
            <ModelVersionSelect
              className="absolute right-3 h-max"
              entities={entities}
              onSelect={onSelect}
              currentEntity={currentEntity}
            />
          </div>
          {description && (
            <span
              className="text-[11px] text-quaternary-bg-light"
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
      {heading && (
        <span className="text-sm font-medium text-primary-bg-light">
          {heading}
        </span>
      )}
      <div
        className={classNames(
          'grid min-h-0 shrink grid-cols-1 gap-3',
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
