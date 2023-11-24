import {
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { IconChevronDown } from '@tabler/icons-react';
import { FC, useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { doesModelContainSearchTerm } from '@/src/utils/app/search';

import { EntityType } from '@/src/types/common';
import {
  OpenAIEntity,
  OpenAIEntityModel
} from '@/src/types/openai';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import XMark from '../../../public/images/icons/xmark.svg';
import { EntityMarkdownDescription } from '../Common/MarkdownDescription';
import { NoResultsFound } from '../Common/NoResultsFound';

const Entity = ({
  entity,
  selectedModelId,
  onSelect,
}: {
  entity: OpenAIEntity;
  selectedModelId: string | undefined;
  onSelect: (id: string) => void;
}) => {
  const theme = useAppSelector(UISelectors.selectThemeState);

  const [isOpened, setIsOpened] = useState(false);

  return (
    <button
      key={entity.id}
      className={`flex items-center gap-3 rounded border px-3 py-2 hover:border-gray-800 dark:hover:border-gray-200 ${
        selectedModelId === entity.id
          ? 'border-blue-500'
          : 'border-gray-400 dark:border-gray-600'
      } ${isOpened ? 'md:col-span-2' : 'md:col-span-1'}`}
      onClick={() => {
        onSelect(entity.id);
      }}
      data-qa="group-entity"
    >
      <ModelIcon
        entityId={entity.id}
        entity={entity}
        size={24}
        inverted={theme === 'dark'}
      />
      <div className="flex flex-col gap-1 text-left">
        <span data-qa="group-entity-name">{entity.name}</span>
        {entity.description && (
          <span
            className="text-gray-500"
            onClick={(e) => {
              if ((e.target as HTMLAnchorElement)?.tagName === 'A') {
                e.stopPropagation();
              }
            }}
            data-qa="group-entity-descr"
          >
            <EntityMarkdownDescription isShortDescription={!isOpened}>
              {entity.description}
            </EntityMarkdownDescription>
          </span>
        )}
      </div>
      {entity.description && entity.description.indexOf('\n\n') !== -1 && (
        <span>
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
              className={`transition-all ${isOpened ? 'rotate-180' : ''}`}
            />
          </button>
        </span>
      )}
    </button>
  );
};

interface EntityListingProps {
  entities: OpenAIEntity[];
  heading: string;
  selectedModelId: string | undefined;
  onSelect: (entityId: string) => void;
}

const EntityListing = ({
  entities,
  heading,
  selectedModelId,
  onSelect,
}: EntityListingProps) => {
  return (
    <div className="flex flex-col gap-3 text-xs" data-qa="talk-to-group">
      <span className="text-gray-500">{heading}</span>
      <div className="grid min-h-0 shrink grid-cols-1 gap-3 overflow-y-auto md:grid-cols-2">
        {entities.map((entity) => (
          <Entity
            key={entity.id}
            entity={entity}
            selectedModelId={selectedModelId}
            onSelect={(id) => {
              onSelect(id);
            }}
          />
        ))}
      </div>
    </div>
  );
};

interface Props {
  selectedModelId: string | undefined;
  isOpen: boolean;
  onModelSelect: (selectedModelId: string) => void;
  onClose: () => void;
}

const getFilteredEntities = (
  models: OpenAIEntityModel[],
  entityTypes: string[],
  searchTerm: string,
) => {
  return models.filter(
    (model) =>
      entityTypes.includes(model.type) &&
      doesModelContainSearchTerm(model, searchTerm),
  );
};

export const ModelsDialog: FC<Props> = ({
  selectedModelId,
  isOpen,
  onModelSelect,
  onClose,
}) => {
  const { t } = useTranslation('chat');
  const dispatch = useAppDispatch();
  const models = useAppSelector(ModelsSelectors.selectModels);

  const [entityTypes, setEntityTypes] = useState<EntityType[]>([
    EntityType.Model,
    EntityType.Assistant,
    EntityType.Application,
  ]);
  const [filteredModelsEntities, setFilteredModelsEntities] = useState<
    OpenAIEntity[]
  >([]);
  const [filteredAssistantsEntities, setFilteredAssistantsEntities] = useState<
    OpenAIEntity[]
  >([]);
  const [filteredApplicationsEntities, setFilteredApplicationsEntities] =
    useState<OpenAIEntity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: () => {
      onClose();
    },
  });
  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  useEffect(() => {
    const newFilteredEntities = getFilteredEntities(
      models,
      entityTypes,
      searchTerm,
    );

    setFilteredModelsEntities(
      newFilteredEntities.filter((entity) => entity.type === EntityType.Model),
    );
    setFilteredAssistantsEntities(
      newFilteredEntities.filter(
        (entity) => entity.type === EntityType.Assistant,
      ),
    );
    setFilteredApplicationsEntities(
      newFilteredEntities.filter(
        (entity) => entity.type === EntityType.Application,
      ),
    );
  }, [models, entityTypes, searchTerm]);

  const handleSearch = useCallback((searchValue: string) => {
    setSearchTerm(searchValue.trim().toLowerCase());
  }, []);

  useEffect(() => {
    setSearchTerm('');
    setEntityTypes([
      EntityType.Model,
      EntityType.Assistant,
      EntityType.Application,
    ]);
  }, [isOpen]);

  const handleFilterType = useCallback((entityType: EntityType) => {
    setEntityTypes((entityTypes) => {
      if (entityTypes.includes(entityType)) {
        return entityTypes.filter(
          (currentEntityType) => currentEntityType !== entityType,
        );
      }

      return [...entityTypes, entityType];
    });
  }, []);

  const handleSelectModel = useCallback(
    (entityId: string) => {
      onModelSelect(entityId);
      dispatch(ModelsActions.updateRecentModels({ modelId: entityId }));
      onClose();
    },
    [dispatch, onClose, onModelSelect],
  );

  // Render nothing if the dialog is not open.
  if (!isOpen) {
    return <></>;
  }

  // Render the dialog.
  return (
    <FloatingPortal id="chat">
      <div className="fixed inset-0 top-[48px] z-30 flex items-center justify-center bg-gray-900/30 p-3 dark:bg-gray-900/70 md:p-5">
        <div
          className="flex h-full w-full grow flex-col gap-4 rounded bg-gray-100 py-4 text-left dark:bg-gray-700 md:grow-0 xl:max-w-[720px] 2xl:max-w-[780px]"
          role="dialog"
          ref={refs.setFloating}
          {...getFloatingProps()}
          data-qa="models-dialog"
        >
          <div className="flex justify-between px-3 md:px-5">
            {t('Talk to')}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-blue-500"
              data-qa="close-models-dialog"
            >
              <XMark height={24} width={24} />
            </button>
          </div>

          <div className="px-3 md:px-5">
            <input
              name="titleInput"
              placeholder={t('Search model, assistant or application') || ''}
              type="text"
              onChange={(e) => {
                handleSearch(e.target.value);
              }}
              className="m-0 w-full rounded border border-gray-400 bg-transparent px-3 py-2 outline-none placeholder:text-gray-500 focus-visible:border-blue-500 dark:border-gray-600 dark:focus-visible:border-blue-500"
            ></input>
          </div>

          <div className="flex gap-2 px-3 md:px-5">
            <button
              className={classNames(
                'rounded border-b-2 px-3 py-2 hover:bg-blue-500/20 dark:hover:bg-blue-500/20',
                entityTypes.includes(EntityType.Model)
                  ? 'border-blue-500 bg-blue-500/20 dark:bg-blue-500/20'
                  : 'border-gray-400 bg-gray-400 hover:border-transparent dark:border-gray-600 dark:bg-gray-600 dark:hover:border-transparent',
              )}
              onClick={() => {
                handleFilterType(EntityType.Model);
              }}
            >
              {t('Models')}
            </button>
            <button
              className={classNames(
                'rounded border-b-2 px-3 py-2 hover:bg-blue-500/20 dark:hover:bg-blue-500/20',
                entityTypes.includes(EntityType.Assistant)
                  ? 'border-blue-500 bg-blue-500/20 dark:bg-blue-500/20'
                  : 'border-gray-400 bg-gray-400 hover:border-transparent dark:border-gray-600 dark:bg-gray-600 dark:hover:border-transparent',
              )}
              onClick={() => {
                handleFilterType(EntityType.Assistant);
              }}
            >
              {t('Assistants')}
            </button>
            <button
              className={classNames(
                'rounded border-b-2 px-3 py-2 hover:bg-blue-500/20 dark:hover:bg-blue-500/20',
                entityTypes.includes(EntityType.Application)
                  ? 'border-blue-500 bg-blue-500/20 dark:bg-blue-500/20'
                  : 'border-gray-400 bg-gray-400 hover:border-transparent dark:border-gray-600 dark:bg-gray-600 dark:hover:border-transparent',
              )}
              onClick={() => {
                handleFilterType(EntityType.Application);
              }}
            >
              {t('Applications')}
            </button>
          </div>

          <div className="flex grow flex-col gap-4 overflow-auto px-3 pb-2 md:px-5">
            {filteredModelsEntities?.length > 0 ||
            filteredAssistantsEntities?.length > 0 ||
            filteredApplicationsEntities?.length > 0 ? (
              <>
                {filteredModelsEntities.length > 0 && (
                  <EntityListing
                    entities={filteredModelsEntities}
                    heading={t('Models')}
                    onSelect={handleSelectModel}
                    selectedModelId={selectedModelId}
                  />
                )}
                {filteredAssistantsEntities.length > 0 && (
                  <EntityListing
                    entities={filteredAssistantsEntities}
                    heading={t('Assistants')}
                    onSelect={handleSelectModel}
                    selectedModelId={selectedModelId}
                  />
                )}
                {filteredApplicationsEntities.length > 0 && (
                  <EntityListing
                    entities={filteredApplicationsEntities}
                    heading={t('Applications')}
                    onSelect={handleSelectModel}
                    selectedModelId={selectedModelId}
                  />
                )}
              </>
            ) : (
              <div className="flex grow items-center justify-center">
                <NoResultsFound />
              </div>
            )}
          </div>
        </div>
      </div>
    </FloatingPortal>
  );
};
