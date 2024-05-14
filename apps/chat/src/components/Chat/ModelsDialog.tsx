import { IconX } from '@tabler/icons-react';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { doesOpenAIEntityContainSearchTerm } from '@/src/utils/app/search';

import { EntityType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { DialAIEntity, DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import Modal from '@/src/components/Common/Modal';

import { NoResultsFound } from '../Common/NoResultsFound';
import { ModelList } from './ModelList';

interface ModelsDialogProps {
  selectedModelId: string | undefined;
  isOpen: boolean;
  onModelSelect: (selectedModelId: string, rearrange?: boolean) => void;
  onClose: () => void;
}

interface Model {
  id: string;
  name: string;
  isDefault: boolean;
  description: string;
  iconUrl: string;
  type: EntityType;
  limits?: {
    maxRequestTokens: number;
    maxResponseTokens: number;
    maxTotalTokens: number;
    isMaxRequestTokensCustom: boolean;
  };
  features: {
    systemPrompt: boolean;
    truncatePrompt: boolean;
    urlAttachments: boolean;
  };
  inputAttachmentTypes?: string[];
}

const getFilteredEntities = (
  models: DialAIEntityModel[],
  entityTypes: string[],
  searchTerm: string,
) => {
  return models.filter(
    (model) =>
      entityTypes.includes(model.type) &&
      doesOpenAIEntityContainSearchTerm(model, searchTerm),
  );
};

export const ModelsDialog: FC<ModelsDialogProps> = ({
  selectedModelId,
  isOpen,
  onModelSelect,
  onClose,
}) => {
  const { t } = useTranslation(Translation.Chat);
  const models = useAppSelector(ModelsSelectors.selectModels);

  const [entityTypes, setEntityTypes] = useState<EntityType[]>([
    EntityType.Model,
    EntityType.Assistant,
    EntityType.Application,
  ]);
  const [filteredModelsEntities, setFilteredModelsEntities] = useState<
    DialAIEntity[]
  >([]);
  const [filteredAssistantsEntities, setFilteredAssistantsEntities] = useState<
    DialAIEntity[]
  >([]);
  const [filteredApplicationsEntities, setFilteredApplicationsEntities] =
    useState<DialAIEntity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const countEntityTypes = (models: Model[]): Record<EntityType, number> => {
    const counts: Record<EntityType, number> = {
      model: 0,
      assistant: 0,
      application: 0,
      addon: 0,
    };

    models.forEach((model) => {
      if (counts[model.type] !== undefined) {
        counts[model.type]++;
      }
    });

    return counts;
  };

  const typeCounts = useMemo(
    () => countEntityTypes(models as Model[]),
    [models],
  );

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
      onModelSelect(entityId, true);
      onClose();
    },
    [onClose, onModelSelect],
  );

  return (
    <Modal
      dataQa="models-dialog"
      portalId="chat"
      onClose={onClose}
      overlayClassName="fixed inset-0 top-[48px]"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      hideClose
      containerClassName="m-auto flex size-full grow flex-col gap-4 divide-tertiary overflow-y-auto py-4 md:grow-0 xl:max-w-[720px] 2xl:max-w-[780px] bg-layer-2"
    >
      <div className="flex justify-between px-3 md:px-5">
        {t('Talk to')}
        <button
          onClick={onClose}
          className="text-secondary-bg-dark hover:text-accent-primary"
          data-qa="close-models-dialog"
        >
          <IconX height={24} width={24} />
        </button>
      </div>

      <div className="px-3 md:px-5">
        <input
          name="titleInput"
          placeholder={t('Search model or application') || ''}
          type="text"
          onChange={(e) => {
            handleSearch(e.target.value);
          }}
          className="m-0 w-full rounded border border-primary bg-transparent px-3 py-2 outline-none placeholder:text-secondary-bg-dark focus-visible:border-accent-primary"
        ></input>
      </div>

      <div className="flex gap-2 px-3 md:px-5">
        <button
          className={classNames(
            'rounded border-b-2 px-3 py-2 hover:bg-accent-primary-alpha',
            entityTypes.includes(EntityType.Model)
              ? 'border-accent-primary bg-accent-primary-alpha'
              : 'border-primary bg-layer-4 hover:border-transparent',
          )}
          onClick={() => {
            handleFilterType(EntityType.Model);
          }}
          data-qa="models-tab"
        >
          {`${t('Models')} (${typeCounts.model})`}
        </button>
        {/*<button*/}
        {/*  className={classNames(*/}
        {/*    'rounded border-b-2 px-3 py-2 hover:bg-accent-primary-alpha',*/}
        {/*    entityTypes.includes(EntityType.Assistant)*/}
        {/*      ? 'border-accent-primary bg-accent-primary-alpha'*/}
        {/*      : 'border-primary bg-layer-4 hover:border-transparent',*/}
        {/*  )}*/}
        {/*  onClick={() => {*/}
        {/*    handleFilterType(EntityType.Assistant);*/}
        {/*  }}*/}
        {/*  data-qa="assistants-tab"*/}
        {/*>*/}
        {/*  {`${t('Assistants')} (${typeCounts.assistant})`}*/}
        {/*</button>*/}
        <button
          className={classNames(
            'rounded border-b-2 px-3 py-2 hover:bg-accent-primary-alpha',
            entityTypes.includes(EntityType.Application)
              ? 'border-accent-primary bg-accent-primary-alpha'
              : 'border-primary bg-layer-4 hover:border-transparent',
          )}
          onClick={() => {
            handleFilterType(EntityType.Application);
          }}
          data-qa="applications-tab"
        >
          {`${t('Applications')} (${typeCounts.application})`}
        </button>
      </div>

      <div className="flex grow flex-col gap-4 overflow-auto px-3 pb-2 md:px-5">
        {filteredModelsEntities?.length > 0 ||
        filteredAssistantsEntities?.length > 0 ||
        filteredApplicationsEntities?.length > 0 ? (
          <>
            {filteredModelsEntities.length > 0 && (
              <ModelList
                entities={filteredModelsEntities}
                heading={t('Models') || ''}
                onSelect={handleSelectModel}
                selectedModelId={selectedModelId}
                allEntities={models}
                searchTerm={searchTerm}
              />
            )}
            {filteredAssistantsEntities.length > 0 && (
              <ModelList
                entities={filteredAssistantsEntities}
                heading={t('Assistants') || ''}
                onSelect={handleSelectModel}
                selectedModelId={selectedModelId}
                allEntities={models}
                searchTerm={searchTerm}
              />
            )}
            {filteredApplicationsEntities.length > 0 && (
              <ModelList
                entities={filteredApplicationsEntities}
                heading={t('Applications') || ''}
                onSelect={handleSelectModel}
                selectedModelId={selectedModelId}
                allEntities={models}
                searchTerm={searchTerm}
              />
            )}
          </>
        ) : (
          <div className="flex grow items-center justify-center">
            <NoResultsFound />
          </div>
        )}
      </div>
    </Modal>
  );
};
