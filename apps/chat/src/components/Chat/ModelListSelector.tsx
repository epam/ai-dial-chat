import { IconCaretDownFilled } from '@tabler/icons-react';
import { MouseEvent, useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { getValidEntitiesFromIds } from '@/src/utils/app/conversation';

import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';

import { ModelId } from '@/src/constants/chat';

import { ModelsDialog_V2 } from '@/src/components/Chat/ModelsDialog_v2';
import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';

import { ModelIcon } from '../Chatbar/ModelIcon';

import { DallIcon } from '@/src/icons';
import { find, take } from 'lodash';

interface Props {
  modelId: string | undefined;
  onModelSelect: (modelId: string) => void;
  temperature: number | undefined;
  onChangeTemperature: (temperature: number) => void;
}

const MAX_ITEMS_IN_MODELS_DROPDOWN = 2;

export const ModelListSelector = ({
  modelId,
  onModelSelect,
  temperature,
  onChangeTemperature,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const recentModelsIds = useAppSelector(ModelsSelectors.selectRecentModelsIds);
  const [isModelsDialogOpen, setIsModelsDialogOpen] = useState(false);

  const entities = useMemo(() => {
    const modelIds =
      modelId && recentModelsIds && recentModelsIds.includes(modelId)
        ? recentModelsIds.filter((model) => model !== modelId)
        : recentModelsIds;
    const recentEntities = getValidEntitiesFromIds(modelIds, modelsMap);
    const recentEntitiesModelsOnly = recentEntities.filter(
      (model) => model?.type === 'model',
    );

    return take(recentEntitiesModelsOnly, MAX_ITEMS_IN_MODELS_DROPDOWN);
  }, [modelId, modelsMap, recentModelsIds]);

  const selectedEntity = useMemo(
    () => find(modelsMap, (item) => item?.id === modelId),
    [modelsMap, modelId],
  );

  const handleModelSelect = useCallback(
    (entityId: string, rearrange?: boolean) => {
      onModelSelect(entityId);
      dispatch(
        ModelsActions.updateRecentModels({
          modelId: entityId,
          rearrange,
        }),
      );
    },
    [dispatch, onModelSelect],
  );

  const onChangeModelHandler = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      const entityId = e.currentTarget.value;
      onModelSelect(entityId);
      dispatch(
        ModelsActions.updateRecentModels({
          modelId: entityId,
          rearrange: true,
        }),
      );
    },
    [dispatch, onModelSelect],
  );

  return (
    <div className="entity-selector w-full" data-qa="entity-selector">
      <div className="h-[40px] rounded-full border border-secondary bg-layer-2 shadow-primary hover:cursor-pointer hover:border-tertiary">
        <Menu
          className="flex w-full items-center"
          trigger={
            <div className="flex w-full cursor-pointer items-center justify-between pl-4 pr-2">
              <div className="flex items-center gap-2">
                {selectedEntity?.id === ModelId.DALL ? (
                  <div className="ml-[-3px]">
                    <DallIcon />
                  </div>
                ) : (
                  <ModelIcon
                    entityId={selectedEntity?.id || ''}
                    entity={selectedEntity}
                    size={18}
                  />
                )}
                <span>{selectedEntity?.name}</span>
              </div>
              <IconCaretDownFilled
                className="text-quaternary-bg-light"
                size={12}
              />
            </div>
          }
        >
          {entities.map((model) => (
            <MenuItem
              key={model.id}
              className="entity-menu-selector-item max-w-full border-b border-secondary bg-layer-2 hover:bg-accent-secondary-alpha"
              item={
                <div className="flex size-full items-center gap-2 pl-1 text-primary-bg-light">
                  {model.id === ModelId.DALL ? (
                    <div className="ml-[-3px]">
                      <DallIcon />
                    </div>
                  ) : (
                    <ModelIcon entityId={model.id} entity={model} size={18} />
                  )}
                  <span>{t(model.name)}</span>
                </div>
              }
              value={model.id}
              onClick={onChangeModelHandler}
            />
          ))}
          <MenuItem
            key={'see-full-list'}
            className="max-w-full bg-layer-2 text-secondary-bg-dark hover:text-pr-primary-700"
            item={t('See full list...')}
            onClick={() => setIsModelsDialogOpen(true)}
          />
        </Menu>
      </div>
      <ModelsDialog_V2
        selectedModelId={modelId}
        isOpen={isModelsDialogOpen}
        onModelSelect={handleModelSelect}
        onClose={() => setIsModelsDialogOpen(false)}
        temperature={temperature}
        onChangeTemperature={onChangeTemperature}
      />
    </div>
  );
};
