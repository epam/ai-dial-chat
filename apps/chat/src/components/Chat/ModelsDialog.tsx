import { IconSearch, IconX } from '@tabler/icons-react';
import { FC, useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { doesOpenAIEntityContainSearchTerm } from '@/src/utils/app/search';

import { EntityType } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { ModalState } from '@/src/types/modal';
import { DialAIEntity, DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import ModelsDialogFilterRenderer from '@/src/components/Chat/ModelsDialogFilterRenderer';
import ContextMenu from '@/src/components/Common/ContextMenu';
import Modal from '@/src/components/Common/Modal';
import Tooltip from '@/src/components/Common/Tooltip';

import { NoResultsFound } from '../Common/NoResultsFound';
import { ModelList } from './ModelList';

import FilterIcon from '@/public/images/icons/filter.svg';

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

  const onClickMenuItemHandler = (entityType: any) => {
    handleFilterType(entityType);
  };

  const menuItems: DisplayMenuItemProps[] = [
    {
      display: true,
      name: t('Models'),
      dataQa: 'models',
      customTriggerData: {
        type: EntityType.Model,
        isSelected: entityTypes.includes(EntityType.Model),
      },
    },
    {
      display: false,
      name: t('Assistants'),
      dataQa: 'assistants',
      customTriggerData: {
        type: EntityType.Assistant,
        isSelected: entityTypes.includes(EntityType.Assistant),
      },
    },
    {
      display: true,
      name: t('Applications'),
      dataQa: 'applications',
      customTriggerData: {
        type: EntityType.Application,
        isSelected: entityTypes.includes(EntityType.Application),
      },
    },
  ].map((item) => ({
    ...item,
    onClick: onClickMenuItemHandler,
    CustomTriggerRenderer: ModelsDialogFilterRenderer,
  }));

  return (
    <Modal
      dataQa="models-dialog"
      portalId="chat"
      onClose={onClose}
      overlayClassName="fixed inset-0 top-[48px]"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      hideClose
      containerClassName="m-auto flex size-full grow flex-col gap-4 divide-tertiary overflow-y-auto pb-4 md:grow-0 xl:max-w-[720px] 2xl:max-w-[780px]"
    >
      <div className="text-primary-bg-dark flex justify-between bg-layer-3 px-3 py-6 text-xl font-medium md:px-5">
        {t('Talk to')}
        <button
          onClick={onClose}
          className="text-primary-bg-dark hover:text-accent-primary"
          data-qa="close-models-dialog"
        >
          <IconX height={24} width={24} />
        </button>
      </div>

      <div className="relative px-3 md:px-5">
        <IconSearch
          className="absolute left-9 top-2.5 md:left-11"
          width={18}
          height={18}
        />
        <input
          name="titleInput"
          placeholder={t('Search model or application') || ''}
          type="text"
          onChange={(e) => {
            handleSearch(e.target.value);
          }}
          className="placeholder:text-tertiary-bg-light focus-within:border-accent-quaternary focus-within:shadow-primary hover:border-accent-quaternary m-0 w-full rounded-full border border-secondary bg-layer-2 py-2 pl-14 pr-3 outline-none"
        ></input>
        <ContextMenu
          menuItems={menuItems}
          triggerIconClassName="absolute right-8 md:right-12 cursor-pointer max-h-[38px]"
          TriggerCustomRenderer={
            <Tooltip tooltip={t('Search filter')} hideTooltip={isOpen}>
              <div className="text-quaternary-bg-light hover:text-primary-bg-light flex items-end">
                <FilterIcon width={20} height={20} className="inline-block" />
                <span className="hidden pl-2 md:inline-block">
                  {t('Filters')}
                </span>
              </div>
            </Tooltip>
          }
        ></ContextMenu>
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
