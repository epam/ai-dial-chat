import { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  OpenAIEntity,
  OpenAIEntityApplicationType,
  OpenAIEntityAssistantType,
  OpenAIEntityModel,
  OpenAIEntityModelType,
} from '@/types/openai';

import HomeContext from '@/pages/api/home/home.context';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import XMark from '../../public/images/icons/xmark.svg';
import { NoResultsFound } from '../Common/NoResultsFound';
import { MemoizedReactMarkdown } from '../Markdown/MemoizedReactMarkdown';

import remarkGfm from 'remark-gfm';

interface Props {
  selectedModelId: string;
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
  const {
    state: { models, lightMode },
    handleUpdateRecentModels,
  } = useContext(HomeContext);
  const modalRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        window.addEventListener('mouseup', handleMouseUp);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mouseup', handleMouseUp);
      onClose();
    };

    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onClose]);

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

  const getEntityTemplate = (entity: OpenAIEntity) => {
    return (
      <button
        key={entity.id}
        className={`flex items-center gap-3 rounded border px-3 py-2  ${
          selectedModelId === entity.id
            ? 'border-blue-500'
            : 'border-gray-400 dark:border-gray-600'
        }`}
        onClick={() => {
          onModelSelect(entity.id);
          handleUpdateRecentModels(entity.id);
          onClose();
        }}
      >
        <ModelIcon
          entityId={entity.id}
          entity={entity}
          size={24}
          inverted={lightMode === 'dark'}
        />
        <div className="flex flex-col text-left">
          <span>{entity.name}</span>
          {entity.description && (
            <MemoizedReactMarkdown remarkPlugins={[remarkGfm]}>
              {entity.description}
            </MemoizedReactMarkdown>
          )}
        </div>
      </button>
    );
  };

  const getEntityListingTemplate = (
    entities: OpenAIEntity[],
    heading: string,
  ) => {
    return (
      <div className="flex flex-col gap-3 text-xs">
        <span className="text-gray-500">{heading}</span>
        <div className="grid min-h-0 shrink grid-cols-1 gap-3 overflow-y-auto md:grid-cols-2">
          {entities.map((entity) => getEntityTemplate(entity))}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70">
      <div className="fixed inset-0 z-10 overflow-hidden">
        <div className="flex h-screen items-center justify-center p-3 text-center">
          <div
            ref={modalRef}
            className="flex h-full w-[calc(100%-12px)] grow flex-col gap-4 overflow-y-auto rounded bg-gray-100 px-5 py-4 text-left dark:bg-gray-700 md:w-[790px] md:grow-0"
            role="dialog"
          >
            <div className="flex justify-between">
              {t('Talk to')}
              <button onClick={onClose} className="text-gray-500">
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
                className="m-0 w-full rounded border border-gray-400 bg-transparent px-3 py-2 dark:border-gray-600"
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
              <div className="flex grow items-center justify-center ">
                <NoResultsFound />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
