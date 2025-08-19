import { useCallback } from 'react';

import {
  isApplicationPublic,
  isExternalApp,
} from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';

import { ShareActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { FunctionStatusIndicator } from '@/src/components/Marketplace/FunctionStatusIndicator';

import { EntityHeader } from '../EntityDetailsHeader';
import { ApplicationCopyLink } from './ApplicationCopyLink';

import { Feature } from '@epam/ai-dial-shared';

interface Props {
  entity: DialAIEntityModel;
  isPreview?: boolean;
}

export const ApplicationDetailsHeader = ({ entity, isPreview }: Props) => {
  const dispatch = useAppDispatch();

  const isMyApp = isMyApplication(entity);
  const isPublicApp = isApplicationPublic(entity);
  const handleOpenSharing = useCallback(() => {
    dispatch(
      ShareActions.share({
        featureType: FeatureType.Application,
        entity: entity,
      }),
    );
  }, [dispatch, entity]);

  const isApplicationsSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.ApplicationsSharing),
  );

  return (
    <EntityHeader<DialAIEntityModel>
      entity={entity}
      featureType={FeatureType.Application}
      isMyEntity={isMyApp}
      isExternal={isExternalApp(entity)}
      isPreview={isPreview}
      shareAction={{
        isEnabled: isApplicationsSharingEnabled,
        onShare: handleOpenSharing,
      }}
      copyLinkAction={{
        isPublic: isPublicApp,
        component: ApplicationCopyLink,
      }}
      StatusIndicator={FunctionStatusIndicator}
      dataQa="application-header"
    />
  );
};
