import {
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { IconX } from '@tabler/icons-react';
import { FC, useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { doesOpenAIEntityContainSearchTerm } from '@/src/utils/app/search';

import { EntityType } from '@/src/types/common';
import { OpenAIEntity, OpenAIEntityModel } from '@/src/types/openai';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { NoResultsFound } from '../Common/NoResultsFound';
import { ModelList } from './ModelList';

interface ModelsDialogProps {
  selectedModelId: string | undefined;
  isOpen: boolean;
  onModelSelect: (selectedModelId: string, rearrange?: boolean) => void;
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
      onModelSelect(entityId, true);
      onClose();
    },
    [onClose, onModelSelect],
  );

  // Render nothing if the dialog is not open.
  if (!isOpen) {
    return <></>;
  }

  // Render the dialog.
  return (
    <FloatingPortal id="chat">
      <div className="fixed inset-0 top-[48px] z-30 flex items-center justify-center bg-blackout p-3 md:p-5">
        <div
          className="flex size-full grow flex-col gap-4 rounded bg-layer-3 py-4 text-left md:grow-0 xl:max-w-[720px] 2xl:max-w-[780px]"
          role="dialog"
          ref={refs.setFloating}
          {...getFloatingProps()}
          data-qa="models-dialog"
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

          <div className="px-3 md:px-5">
            <input
              name="titleInput"
              placeholder={t('Search model, assistant or application') || ''}
              type="text"
              onChange={(e) => {
                handleSearch(e.target.value);
              }}
              className="m-0 w-full rounded border border-primary bg-transparent px-3 py-2 outline-none placeholder:text-secondary focus-visible:border-accent-primary"
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
              {t('Models')}
            </button>
            <button
              className={classNames(
                'rounded border-b-2 px-3 py-2 hover:bg-accent-primary-alpha',
                entityTypes.includes(EntityType.Assistant)
                  ? 'border-accent-primary bg-accent-primary-alpha'
                  : 'border-primary bg-layer-4 hover:border-transparent',
              )}
              onClick={() => {
                handleFilterType(EntityType.Assistant);
              }}
              data-qa="assistants-tab"
            >
              {t('Assistants')}
            </button>
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
              {t('Applications')}
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
                  />
                )}
                {filteredAssistantsEntities.length > 0 && (
                  <ModelList
                    entities={filteredAssistantsEntities}
                    heading={t('Assistants') || ''}
                    onSelect={handleSelectModel}
                    selectedModelId={selectedModelId}
                    allEntities={models}
                  />
                )}
                {filteredApplicationsEntities.length > 0 && (
                  <ModelList
                    entities={filteredApplicationsEntities}
                    heading={t('Applications') || ''}
                    onSelect={handleSelectModel}
                    selectedModelId={selectedModelId}
                    allEntities={models}
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
