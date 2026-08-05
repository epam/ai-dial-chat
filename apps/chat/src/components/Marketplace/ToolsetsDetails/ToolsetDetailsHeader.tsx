import { useCallback, useMemo } from 'react';

import {
  isMarketplaceEntityPublic,
  withEntityIdName,
} from '@/src/utils/app/application';
import { isMyEntity } from '@/src/utils/app/shared-utils';

import { ToolsetModel } from '@/src/types/toolsets';

import { ShareActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { EntityHeader } from '../EntityDetailsHeader';
import { MarketplaceCopyLink } from '../MarketplaceCopyLink';

import { Feature, FeatureType } from '@epam/ai-dial-shared';

interface Props {
  entity: ToolsetModel;
  isPreview?: boolean;
}

export function ToolsetDetailsHeader({ entity, isPreview }: Props) {
  const dispatch = useAppDispatch();

  const isMyToolset = isMyEntity(entity);
  const isPublicToolset = isMarketplaceEntityPublic(entity);
  const handleOpenSharing = useCallback(() => {
    dispatch(
      ShareActions.share({
        featureType: FeatureType.Toolset,
        entity: withEntityIdName(entity),
      }),
    );
  }, [dispatch, entity]);

  const isToolsetSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.ToolsetsSharing),
  );

  const shareAction = useMemo(
    () => ({
      isEnabled: isToolsetSharingEnabled,
      onShare: handleOpenSharing,
    }),
    [handleOpenSharing, isToolsetSharingEnabled],
  );

  const copyLinkAction = useMemo(
    () => ({
      isPublic: isPublicToolset,
      Component: MarketplaceCopyLink,
    }),
    [isPublicToolset],
  );

  return (
    <EntityHeader<ToolsetModel>
      entity={entity}
      featureType={FeatureType.Toolset}
      isMyEntity={isMyToolset}
      isPreview={isPreview}
      shareAction={shareAction}
      copyLinkAction={copyLinkAction}
      //TODO add ToolsetStatusIndicator
      //   StatusIndicator={ToolsetStatusIndicator}
      dataQa="toolset-header"
    />
  );
}
