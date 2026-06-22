import { IconCloudUpload, IconPlayerPlay } from '@tabler/icons-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useApplicationStatusActions } from '@/src/hooks/useApplicationStatusActions';
import { useHasDeployAccess } from '@/src/hooks/useHasDeployAccess';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getApplicationSimpleStatus,
  isExecutableApp,
  isExternalApp,
  isMarketplaceEntityPublic,
} from '@/src/utils/app/application';
import { doesAgentHaveChatCompletion } from '@/src/utils/app/models';

import {
  ApplicationStatus,
  SimpleApplicationStatus,
} from '@/src/types/applications';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { AuthSelectors } from '@/src/store/selectors';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';

export const useApplicationDeployment = (entity: DialAIEntityModel) => {
  const { t } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();
  const { handleDeploy } = useApplicationStatusActions(entity.id);

  const [wasDeployClicked, setWasDeployClicked] = useState(false);

  const simpleStatus = getApplicationSimpleStatus(entity);
  const isDeployed = simpleStatus === SimpleApplicationStatus.UNDEPLOY;
  const isUpdating = simpleStatus === SimpleApplicationStatus.UPDATING;
  const isUndeploying = entity.functionStatus === ApplicationStatus.UNDEPLOYING;

  const isExecutable = isExecutableApp(entity);
  const isPublicApp = isMarketplaceEntityPublic(entity);
  const doesSupportChatCompletion = doesAgentHaveChatCompletion(entity);

  const hasDeployAccess = useHasDeployAccess(entity);
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

  const showAsUseButton =
    !isUndeploying &&
    (isDeployed || isUpdating || wasDeployClicked || !hasDeployAccess);

  const isButtonDisabled =
    (isExecutable &&
      ((!isDeployed && isPublicApp && !isAdmin) ||
        (!isDeployed && !hasDeployAccess) ||
        isUpdating ||
        isUndeploying ||
        (wasDeployClicked && !isDeployed))) ||
    !doesSupportChatCompletion;

  const DeployIcon = showAsUseButton ? IconPlayerPlay : IconCloudUpload;

  const buttonTooltip = useMemo(() => {
    if (!doesSupportChatCompletion) {
      return t(MarketplaceI18nKeys.AbsentChatCompletionDisabledMessage);
    }
    if (!isExecutable) {
      return;
    }
    if (wasDeployClicked && !isDeployed) {
      return t(MarketplaceI18nKeys.ApplicationIsDeploying);
    }
    if (isUpdating || isUndeploying) {
      return t(MarketplaceI18nKeys.ApplicationIsStatus, {
        status: entity.functionStatus?.toLowerCase(),
      });
    }
    if (isButtonDisabled && !hasDeployAccess) {
      if (isPublicApp) {
        return t(MarketplaceI18nKeys.AskAdminToDeploy);
      }
      return t(MarketplaceI18nKeys.AskAuthorToDeploy);
    }
    return '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    doesSupportChatCompletion,
  ]);

  const createButtonClickHandler = useCallback(
    (onUseEntity?: () => void) => (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isExecutable && !isDeployed && hasDeployAccess) {
        setWasDeployClicked(true);
        handleDeploy();
      } else if (!isButtonDisabled) {
        onUseEntity?.();
      }
    },
    [isDeployed, handleDeploy, isExecutable, hasDeployAccess, isButtonDisabled],
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

    return () => {
      dispatch(ApplicationActions.setAppDetails());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
