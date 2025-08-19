import { useCallback } from 'react';

import { isMyEntity } from '@/src/utils/app/shared-utils';

import { ToolsetModel } from '@/src/types/toolsets';

import { ShareActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { EntityHeader } from '../EntityDetailsHeader';

import { Feature, FeatureType } from '@epam/ai-dial-shared';

interface Props {
  entity: ToolsetModel;
  isPreview?: boolean;
}

export function ToolsetDetailsHeader({ entity, isPreview }: Props) {
  const dispatch = useAppDispatch();

  const isMyToolset = isMyEntity(entity);
  //TODO uncomment when ToolsetCopyLink will be ready
  //   const isPublicToolset = isEntityIdPublic(entity);
  const handleOpenSharing = useCallback(() => {
    dispatch(
      ShareActions.share({
        featureType: FeatureType.Toolset,
        entity: entity,
      }),
    );
  }, [dispatch, entity]);

  const isToolsetSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.ToolsetsSharing),
  );

  return (
    <EntityHeader<ToolsetModel>
      entity={entity}
      featureType={FeatureType.Toolset}
      isMyEntity={isMyToolset}
      isPreview={isPreview}
      shareAction={{
        isEnabled: isToolsetSharingEnabled,
        onShare: handleOpenSharing,
      }}
      //TODO add ToolsetCopyLink and ToolsetStatusIndicator
      //   copyLinkAction={{
      //     isPublic: isPublicApp,
      //     component: ToolsetCopyLink,
      //   }}
      //   StatusIndicator={ToolsetStatusIndicator}
      dataQa="toolset-header"
    />
  );
}
