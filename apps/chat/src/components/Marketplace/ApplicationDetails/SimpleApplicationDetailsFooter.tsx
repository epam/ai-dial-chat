import { IconPlayerPlay, IconPlaystationSquare } from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  isApplicationDeployed,
  isApplicationDeploymentInProgress,
} from '@/src/utils/app/application';

import { ApplicationStatus } from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import { Spinner } from '@/src/components/Common/Spinner';

import { ApplicationDetailsFooterProps } from './ApplicationDetails';

import { DialNeutralButton, DialPrimaryButton } from '@epam/ai-dial-ui-kit';

export const SimpleApplicationDetailsFooter = ({
  entity,
  onChangeVersion,
  onRemove,
}: ApplicationDetailsFooterProps) => {
  const { t } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();

  const isAppDeployed = isApplicationDeployed(entity);
  const isAppDeploymentInProgress = isApplicationDeploymentInProgress(entity);
  const isDeploying = entity.functionStatus === ApplicationStatus.DEPLOYING;

  const handleDeploy = useCallback(() => {
    dispatch(
      ApplicationActions.startUpdatingFunctionStatus({
        id: entity.id,
        status: ApplicationStatus.DEPLOYING,
      }),
    );
  }, [dispatch, entity.id]);

  const handleUndeploy = useCallback(() => {
    dispatch(
      ApplicationActions.startUpdatingFunctionStatus({
        id: entity.id,
        status: ApplicationStatus.UNDEPLOYING,
      }),
    );
  }, [dispatch, entity.id]);

  const handleRemove = () => {
    onRemove?.(entity);
  };

  const DeployButton = useMemo(() => {
    if (isAppDeploymentInProgress || isAppDeployed) return DialNeutralButton;

    return DialPrimaryButton;
  }, [isAppDeployed, isAppDeploymentInProgress]);

  const deployButtonProps = useMemo(() => {
    if (isAppDeploymentInProgress) {
      return {
        label: isDeploying ? t('Deploying') : t('Undeploying'),
        iconBefore: <Spinner size={18} className="!text-controls-disable" />,
        'data-qa': 'deploy-pending',
        disabled: true,
      };
    }
    if (isAppDeployed) {
      return {
        label: t('Undeploy'),
        iconBefore: <IconPlaystationSquare size={18} />,
        onClick: handleUndeploy,
        'data-qa': 'undeploy-in-details',
        disabled: false,
      };
    }
    return {
      label: t('Deploy'),
      iconBefore: <IconPlayerPlay size={18} />,
      onClick: handleDeploy,
      'data-qa': 'deploy-in-details',
      disabled: false,
    };
  }, [
    isAppDeploymentInProgress,
    isAppDeployed,
    isDeploying,
    t,
    handleUndeploy,
    handleDeploy,
  ]);

  return (
    <div className="flex items-center justify-end gap-4 p-4">
      <div className="flex items-center gap-4">
        <ModelVersionSelect
          className="h-max"
          entities={[entity]}
          showVersionPrefix
          onSelect={onChangeVersion}
          currentEntity={entity}
        />
        <DialNeutralButton
          onClick={handleRemove}
          data-qa="remove"
          label={t('Remove')}
        />
      </div>

      <div className="flex items-center">
        <DeployButton {...deployButtonProps} />
      </div>
    </div>
  );
};
