import { IconCloudUpload, IconPlayerPlay } from '@tabler/icons-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useApplicationStatusActions } from '@/src/hooks/useApplicationStatusActions';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getApplicationSimpleStatus,
  isExecutableApp,
  isExternalApp,
  isMarketplaceEntityPublic,
} from '@/src/utils/app/application';

import {
  ApplicationStatus,
  SimpleApplicationStatus,
} from '@/src/types/applications';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { AuthSelectors } from '@/src/store/selectors';

export const useApplicationDeployment = (entity: DialAIEntityModel) => {
  const { t } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);
  const { handleDeploy } = useApplicationStatusActions(entity.id);

  const [wasDeployClicked, setWasDeployClicked] = useState(false);

  const simpleStatus = getApplicationSimpleStatus(entity);
  const isDeployed = simpleStatus === SimpleApplicationStatus.UNDEPLOY;
  const isUpdating = simpleStatus === SimpleApplicationStatus.UPDATING;
  const isUndeploying = entity.functionStatus === ApplicationStatus.UNDEPLOYING;

  const isExecutable = isExecutableApp(entity);
  const isPublicApp = isMarketplaceEntityPublic(entity);

  const showAsUseButton =
    !isUndeploying && (isDeployed || isUpdating || wasDeployClicked);

  const isButtonDisabled =
    isExecutable &&
    ((!isDeployed && isPublicApp && !isAdmin) ||
      isUpdating ||
      isUndeploying ||
      (wasDeployClicked && !isDeployed));

  const DeployIcon = showAsUseButton ? IconPlayerPlay : IconCloudUpload;

  const buttonTooltip = useMemo(() => {
    if (!isExecutable) {
      return;
    }
    if (wasDeployClicked && !isDeployed) {
      return t(`Application is deploying`);
    }
    if (isUpdating || isUndeploying) {
      return t(`Application is ${entity.functionStatus?.toLowerCase()}`);
    }
    if (isButtonDisabled && isExecutable) {
      return t(
        isPublicApp && !isAdmin
          ? 'Ask your administrator to deploy this application to be able to use it'
          : 'Ask author to deploy the application to be able to use it',
      );
    }
    return '';
  }, [
    isExecutable,
    wasDeployClicked,
    isDeployed,
    isUpdating,
    isUndeploying,
    isButtonDisabled,
    t,
    entity.functionStatus,
    isPublicApp,
    isAdmin,
  ]);

  const createButtonClickHandler = useCallback(
    (onUseEntity?: () => void) => (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isExecutable && !isDeployed) {
        setWasDeployClicked(true);
        handleDeploy();
      } else {
        onUseEntity?.();
      }
    },
    [isDeployed, handleDeploy],
  );

  useEffect(() => {
    if (isUndeploying || (!isDeployed && !isUpdating)) {
      setWasDeployClicked(false);
    }
  }, [isUndeploying, isDeployed, isUpdating]);

  useEffect(() => {
    if (isExternalApp(entity)) {
      dispatch(ApplicationActions.get({ applicationId: entity.id }));
    }
  }, [dispatch, entity.id]);

  return {
    isExecutable,
    isPublicApp,
    isDeployed,
    isUpdating,
    isUndeploying,
    showAsUseButton,
    isButtonDisabled,
    buttonTooltip,
    DeployIcon,
    createButtonClickHandler,
  };
};
