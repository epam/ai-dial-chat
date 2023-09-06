import {
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { IconChevronDown } from '@tabler/icons-react';
import { FC, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import {
  OpenAIEntity,
  OpenAIEntityApplicationType,
  OpenAIEntityAssistantType,
  OpenAIEntityModel,
  OpenAIEntityModelType,
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
        <span
          className="text-gray-500"
          onClick={(e) => {
            if ((e.target as HTMLAnchorElement)?.tagName === 'A') {
              e.stopPropagation();
            }
          }}
          data-qa="group-entity-descr"
        >
          {entity.description && (
            <EntityMarkdownDescription isShortDescription={!isOpened}>
              {entity.description}
            </EntityMarkdownDescription>
          )}
        </span>
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
      model.name.toLowerCase().trim().includes(searchTerm),
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

  const [entityTypes, setEntityTypes] = useState<
    (
      | OpenAIEntityModelType
      | OpenAIEntityApplicationType
      | OpenAIEntityAssistantType
    )[]
  >(['model', 'assistant', 'application']);
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
      newFilteredEntities.filter((entity) => entity.type === 'model'),
    );
    setFilteredAssistantsEntities(
      newFilteredEntities.filter((entity) => entity.type === 'assistant'),
    );
    setFilteredApplicationsEntities(
      newFilteredEntities.filter((entity) => entity.type === 'application'),
    );
  }, [models, entityTypes, searchTerm]);

  const handleSearch = (searchValue: string) => {
    setSearchTerm(searchValue.trim().toLowerCase());
  };

  useEffect(() => {
    setSearchTerm('');
    setEntityTypes(['model', 'assistant', 'application']);
  }, [isOpen]);

  const handleFilterType = (
    entityType:
      | OpenAIEntityModelType
      | OpenAIEntityApplicationType
      | OpenAIEntityAssistantType,
  ) => {
    setEntityTypes((entityTypes) => {
      if (entityTypes.includes(entityType)) {
        return entityTypes.filter(
          (currentEntityType) => currentEntityType !== entityType,
        );
      }

      return [...entityTypes, entityType];
    });
  };

  const getEntityListingTemplate = (
    entities: OpenAIEntity[],
    heading: string,
  ) => {
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
                onModelSelect(id);
                dispatch(ModelsActions.updateRecentModels({ modelId: id }));
                onClose();
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  // Render nothing if the dialog is not open.
  if (!isOpen) {
    return <></>;
  }

  // Render the dialog.
  return (
    <FloatingPortal id="theme-main">
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70">
        <div
          className="flex h-[90%] w-[calc(100%-12px)] grow flex-col gap-4 rounded bg-gray-100 px-5 py-4 text-left dark:bg-gray-700 md:w-[790px] md:grow-0"
          role="dialog"
          ref={refs.setFloating}
          {...getFloatingProps()}
          data-qa="models-dialog"
        >
          <div className="flex justify-between">
            {t('Talk to')}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-blue-500"
            >
              <XMark height={24} width={24} />
            </button>
          </div>

          <div>
            <input
              name="titleInput"
              placeholder={t('Search model, assistant or application') || ''}
              type="text"
              onChange={(e) => {
                handleSearch(e.target.value);
              }}
              className="m-0 w-full rounded border border-gray-400 bg-transparent px-3 py-2 outline-none focus-visible:border-blue-500 dark:border-gray-600 dark:focus-visible:border-blue-500"
            ></input>
          </div>

          <div className="flex gap-2">
            <button
              className={`rounded border-b-2 px-3 py-2 hover:bg-blue-500/20 dark:bg-gray-600 ${
                entityTypes.includes('model')
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'bg-gray-400'
              }`}
              onClick={() => {
                handleFilterType('model');
              }}
            >
              {t('Models')}
            </button>
            <button
              className={`rounded border-b-2 px-3 py-2 hover:bg-blue-500/20 dark:bg-gray-600 ${
                entityTypes.includes('assistant')
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'bg-gray-400'
              }`}
              onClick={() => {
                handleFilterType('assistant');
              }}
            >
              {t('Assistants')}
            </button>
            <button
              className={`rounded border-b-2 px-3 py-2 hover:bg-blue-500/20 dark:bg-gray-600 ${
                entityTypes.includes('application')
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'bg-gray-400'
              }`}
              onClick={() => {
                handleFilterType('application');
              }}
            >
              {t('Applications')}
            </button>
          </div>

          <div className="flex flex-col gap-4 overflow-auto pb-2">
            {filteredModelsEntities?.length > 0 ||
            filteredAssistantsEntities?.length > 0 ||
            filteredApplicationsEntities?.length > 0 ? (
              <>
                {filteredModelsEntities.length > 0 &&
                  getEntityListingTemplate(filteredModelsEntities, t('Models'))}
                {filteredAssistantsEntities.length > 0 &&
                  getEntityListingTemplate(
                    filteredAssistantsEntities,
                    t('Assistants'),
                  )}
                {filteredApplicationsEntities.length > 0 &&
                  getEntityListingTemplate(
                    filteredApplicationsEntities,
                    t('Applications'),
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
