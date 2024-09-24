import { IconLayoutGridAdd, IconX } from '@tabler/icons-react';
import { FC, useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { isApplicationId } from '@/src/utils/app/id';
import { doesOpenAIEntityContainSearchTerm } from '@/src/utils/app/search';

import { EntityType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import Modal from '@/src/components/Common/Modal';

import { TabButton } from '../Buttons/TabButton';
import { ApplicationDialog } from '../Common/ApplicationDialog';
import { NoResultsFound } from '../Common/NoResultsFound';
import { ModelList } from './ModelList';

import { Feature } from '@epam/ai-dial-shared';

interface ModelsDialogProps {
  selectedModelId: string | undefined;
  isOpen: boolean;
  onModelSelect: (selectedModelId: string, rearrange?: boolean) => void;
  onClose: () => void;
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
  const [applicationModalIsOpen, setApplicationModalIsOpen] = useState(false);

  const isCustomApplicationsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CustomApplications),
  );

  const [entityTypes, setEntityTypes] = useState<EntityType[]>([
    EntityType.Model,
    EntityType.Assistant,
    EntityType.Application,
  ]);
  const [filteredModelsEntities, setFilteredModelsEntities] = useState<
    DialAIEntityModel[]
  >([]);
  const [filteredAssistantsEntities, setFilteredAssistantsEntities] = useState<
    DialAIEntityModel[]
  >([]);
  const [filteredApplicationsEntities, setFilteredApplicationsEntities] =
    useState<DialAIEntityModel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const openAddApplicationModal = useCallback(() => {
    setApplicationModalIsOpen(true);
  }, []);

  const closeAddApplicationModal = useCallback(() => {
    setApplicationModalIsOpen(false);
  }, []);

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
    if (isCustomApplicationsEnabled) {
      setFilteredApplicationsEntities(
        newFilteredEntities.filter(
          (entity) => entity.type === EntityType.Application,
        ),
      );
    } else {
      setFilteredApplicationsEntities(
        newFilteredEntities.filter(
          (entity) => entity.type === EntityType.Application && isApplicationId,
        ),
      );
    }
  }, [models, entityTypes, searchTerm, isCustomApplicationsEnabled]);

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
      containerClassName="m-auto flex size-full grow flex-col gap-4 divide-tertiary overflow-y-auto py-4 md:grow-0 xl:max-w-[720px] 2xl:max-w-[780px]"
      dismissProps={{ outsidePress: true }}
    >
      <div className="flex justify-between px-3 md:px-5">
        {t('Talk to')}
        <button
          onClick={onClose}
          className="text-secondary hover:text-accent-primary"
          data-qa="close-models-dialog"
        >
          <IconX height={24} width={24} />
        </button>
      </div>

      <div className="relative flex px-3 md:px-5">
        <input
          name="titleInput"
          placeholder={t('Search model, assistant, or application') || ''}
          type="text"
          onChange={(e) => {
            handleSearch(e.target.value);
          }}
          className="m-0 w-full grow rounded border border-primary bg-transparent px-3 py-2 outline-none placeholder:text-secondary focus-visible:border-accent-primary"
        ></input>
        {isCustomApplicationsEnabled && (
          <button
            onClick={openAddApplicationModal}
            className="absolute right-3 flex h-full w-[100px] items-center gap-2 text-accent-primary"
          >
            <IconLayoutGridAdd size={18} />
            <span>{t('Add app')}</span>
          </button>
        )}
      </div>

      {applicationModalIsOpen && (
        <ApplicationDialog
          isOpen={applicationModalIsOpen}
          onClose={closeAddApplicationModal}
        />
      )}

      <div className="flex gap-2 px-3 md:px-5">
        <TabButton
          selected={entityTypes.includes(EntityType.Model)}
          onClick={() => {
            handleFilterType(EntityType.Model);
          }}
          dataQA="models-tab"
        >
          {t('Models')}
        </TabButton>
        <TabButton
          selected={entityTypes.includes(EntityType.Assistant)}
          onClick={() => {
            handleFilterType(EntityType.Assistant);
          }}
          dataQA="assistants-tab"
        >
          {t('Assistants')}
        </TabButton>
        <TabButton
          selected={entityTypes.includes(EntityType.Application)}
          onClick={() => {
            handleFilterType(EntityType.Application);
          }}
          dataQA="applications-tab"
        >
          {t('Applications')}
        </TabButton>
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
