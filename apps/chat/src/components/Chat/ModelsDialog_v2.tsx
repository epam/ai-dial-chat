import { IconSearch, IconX } from '@tabler/icons-react';
import { FC, useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { doesOpenAIEntityContainSearchTerm } from '@/src/utils/app/search';

import { EntityType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { DialAIEntity, DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { TemperatureSlider } from '@/src/components/Chat/Temperature';
import Modal from '@/src/components/Common/Modal';

import { NoResultsFound } from '../Common/NoResultsFound';
import { ModelList } from './ModelList';

interface ModelsDialogProps {
  selectedModelId: string | undefined;
  isOpen: boolean;
  onModelSelect: (selectedModelId: string, rearrange?: boolean) => void;
  onClose: () => void;
  temperature: number | undefined;
  onChangeTemperature: (temperature: number) => void;
}

const getFilteredEntities = (
  models: DialAIEntityModel[],
  searchTerm: string,
) => {
  return models.filter((model) =>
    doesOpenAIEntityContainSearchTerm(model, searchTerm),
  );
};

export const ModelsDialog_V2: FC<ModelsDialogProps> = ({
  selectedModelId,
  isOpen,
  onModelSelect,
  onClose,
  temperature,
  onChangeTemperature,
}) => {
  const { t } = useTranslation(Translation.Chat);
  const models = useAppSelector(ModelsSelectors.selectModels);

  const [filteredModelsEntities, setFilteredModelsEntities] = useState<
    DialAIEntity[]
  >([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const newFilteredEntities = getFilteredEntities(models, searchTerm);

    setFilteredModelsEntities(
      newFilteredEntities.filter((entity) => entity.type === EntityType.Model),
    );
  }, [models, searchTerm]);

  const handleSearch = useCallback((searchValue: string) => {
    setSearchTerm(searchValue.trim().toLowerCase());
  }, []);

  useEffect(() => {
    setSearchTerm('');
  }, [isOpen]);

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
      containerClassName="m-auto flex w-full grow flex-col gap-4 divide-tertiary overflow-y-auto pb-4 md:grow-0 xl:max-w-[720px] 2xl:max-w-[780px]"
    >
      <div className="flex justify-between bg-layer-3 px-3 py-6 text-xl font-medium text-primary-bg-dark md:px-5">
        {t('Talk to')}
        <button
          onClick={onClose}
          className="text-primary-bg-dark hover:text-accent-primary"
          data-qa="close-models-dialog"
        >
          <IconX height={24} width={24} />
        </button>
      </div>

      <div className="relative px-3 md:px-8">
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
          className="m-0 w-full rounded-full border border-secondary bg-layer-2 py-2 pl-14 pr-28 outline-none placeholder:text-tertiary-bg-light focus-within:border-accent-quaternary focus-within:shadow-primary hover:border-accent-quaternary"
        ></input>
      </div>

      <div className="mb-5 flex grow flex-col gap-5 divide-y divide-secondary overflow-auto px-3 pb-2 md:px-8">
        {filteredModelsEntities?.length > 0 ? (
          <ModelList
            entities={filteredModelsEntities}
            heading={t('Models') || ''}
            onSelect={handleSelectModel}
            selectedModelId={selectedModelId}
            allEntities={models}
            searchTerm={searchTerm}
          />
        ) : (
          <div className="flex grow items-center justify-center">
            <NoResultsFound />
          </div>
        )}
        <div className="pt-6">
          <TemperatureSlider
            label={t('Temperature Slider')}
            temperature={temperature}
            onChangeTemperature={onChangeTemperature}
          />
        </div>
      </div>
    </Modal>
  );
};
