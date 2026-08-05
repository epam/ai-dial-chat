import { FC, useCallback, useMemo } from 'react';

import { isDialAiEntityModel } from '@/src/utils/app/application';
import { isToolsetEntityModel } from '@/src/utils/app/toolsets';

import { MarketplaceEntity } from '@/src/types/marketplace';

import { ApplicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ModelsSelectors,
  ToolsetSelectors,
} from '@/src/store/selectors';

import { MarketplaceEntitiesTabs } from '@/src/constants/marketplace';

import { withRenderWhenEntities } from '@/src/components/Common/RenderWhen';
import { ApplicationDetails } from '@/src/components/Marketplace/ApplicationDetails/ApplicationDetails';
import { SimpleApplicationDetailsFooter } from '@/src/components/Marketplace/ApplicationDetails/SimpleApplicationDetailsFooter';
import { SimpleToolsetDetailsFooter } from '@/src/components/Marketplace/ToolsetsDetails/SimpleToolsetDetailsFooter';
import { ToolsetDetails } from '@/src/components/Marketplace/ToolsetsDetails/ToolsetDetails';

interface EditorSelectedEntityModalProps {
  selectedEntity: { reference: string; type: MarketplaceEntitiesTabs };
}

const EditorSelectedEntityModalView: FC<EditorSelectedEntityModalProps> = ({
  selectedEntity,
}) => {
  const dispatch = useAppDispatch();

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const toolsetsMap = useAppSelector(ToolsetSelectors.selectToolsetsMap);
  const allModels = useAppSelector(ModelsSelectors.selectModels);
  const allToolsets = useAppSelector((state) =>
    ToolsetSelectors.selectToolsets(state, true),
  );

  const entity = useMemo(
    () =>
      (selectedEntity.type === MarketplaceEntitiesTabs.AGENTS
        ? modelsMap
        : toolsetsMap)[selectedEntity.reference],
    [modelsMap, selectedEntity.reference, selectedEntity.type, toolsetsMap],
  );

  const handleClearSelectedEntity = useCallback(() => {
    dispatch(ApplicationActions.setEditorSelectedEntity());
  }, [dispatch]);

  const handleSetSelectedEntityVersion = useCallback(
    (entity: MarketplaceEntity) => {
      dispatch(
        ApplicationActions.setEditorSelectedEntity({
          reference: entity.reference,
          type: selectedEntity.type,
        }),
      );
    },
    [dispatch, selectedEntity.type],
  );

  const commonDetailsProps = useMemo(
    () => ({
      onClose: handleClearSelectedEntity,
      onChangeVersion: handleSetSelectedEntityVersion,
      isPreview: true,
    }),
    [handleSetSelectedEntityVersion, handleClearSelectedEntity],
  );

  if (!entity) return null;

  return (
    <div data-qa="entity-details-panel">
      {isDialAiEntityModel(entity) && (
        <ApplicationDetails
          entity={entity}
          allEntities={allModels}
          FooterComponent={SimpleApplicationDetailsFooter}
          {...commonDetailsProps}
        />
      )}
      {isToolsetEntityModel(entity) && (
        <ToolsetDetails
          entity={entity}
          allEntities={allToolsets}
          FooterComponent={SimpleToolsetDetailsFooter}
          {...commonDetailsProps}
        />
      )}
    </div>
  );
};

export const EditorSelectedEntityModal =
  withRenderWhenEntities<EditorSelectedEntityModalProps>({
    selectedEntity: ApplicationSelectors.selectEditorSelectedEntity,
  })(EditorSelectedEntityModalView);
