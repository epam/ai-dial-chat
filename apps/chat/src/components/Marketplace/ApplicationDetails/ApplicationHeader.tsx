import { useCallback, useMemo } from 'react';

import {
  isExternalApp,
  isMarketplaceEntityPublic,
  withEntityIdName,
} from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';

import { ShareActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { EntityHeader } from '../EntityDetailsHeader';
import { MarketplaceCopyLink } from '../MarketplaceCopyLink';

import { Feature } from '@epam/ai-dial-shared';

interface Props {
  entity: DialAIEntityModel;
  isPreview?: boolean;
}

export const ApplicationDetailsHeader = ({ entity, isPreview }: Props) => {
  const dispatch = useAppDispatch();

  const isMyApp = isMyApplication(entity);
  const isPublicApp = isMarketplaceEntityPublic(entity);
  const handleOpenSharing = useCallback(() => {
    dispatch(
      ShareActions.share({
        featureType: FeatureType.Application,
        entity: withEntityIdName(entity),
      }),
    );
  }, [dispatch, entity]);

  const isApplicationsSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.ApplicationsSharing),
  );

  const shareAction = useMemo(
    () => ({
      isEnabled: isApplicationsSharingEnabled,
      onShare: handleOpenSharing,
    }),
    [handleOpenSharing, isApplicationsSharingEnabled],
  );

  const copyLinkAction = useMemo(
    () => ({
      isPublic: isPublicApp,
      Component: MarketplaceCopyLink,
    }),
    [isPublicApp],
  );

  return (
    <EntityHeader<DialAIEntityModel>
      entity={entity}
      featureType={FeatureType.Application}
      isMyEntity={isMyApp}
      isExternal={isExternalApp(entity)}
      isPreview={isPreview}
      shareAction={shareAction}
      copyLinkAction={copyLinkAction}
      dataQa="application-header"
    />
  );
};
