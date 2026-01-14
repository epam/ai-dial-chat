import { IconPlayerPlay, IconPlaystationSquare } from '@tabler/icons-react';
import { useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  isApplicationDeployed,
  isApplicationDeploymentInProgress,
  isExecutableApp,
} from '@/src/utils/app/application';

import { ApplicationStatus } from '@/src/types/applications';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import { Spinner } from '@/src/components/Common/Spinner';

import { ApplicationDetailsFooterProps } from './ApplicationDetails';

import { ButtonVariant, DialButton } from '@epam/ai-dial-ui-kit';

interface DeployButtonProps {
  entity: DialAIEntityModel;
}

export const DeployButton = ({ entity }: DeployButtonProps) => {
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

  if (!isExecutableApp(entity)) {
    return null;
  }

  if (isAppDeploymentInProgress) {
    return (
      <DialButton
        label={isDeploying ? t('Deploying') : t('Undeploying')}
        iconBefore={<Spinner size={18} className="!text-controls-disable" />}
        variant={ButtonVariant.Secondary}
        data-qa="deploy-pending"
        disabled
      />
    );
  }

  if (isAppDeployed) {
    return (
      <DialButton
        label={t('Undeploy')}
        iconBefore={<IconPlaystationSquare size={18} />}
        variant={ButtonVariant.Secondary}
        onClick={handleUndeploy}
        data-qa="undeploy-in-details"
      />
    );
  }

  return (
    <DialButton
      label={t('Deploy')}
      iconBefore={<IconPlayerPlay size={18} />}
      variant={ButtonVariant.Primary}
      onClick={handleDeploy}
      data-qa="deploy-in-details"
    />
  );
};

export const SimpleApplicationDetailsFooter = ({
  entity,
  onChangeVersion,
  onRemove,
}: ApplicationDetailsFooterProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const handleRemove = useCallback(() => {
    onRemove?.(entity);
  }, [onRemove, entity]);

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
        <DialButton
          onClick={handleRemove}
          data-qa="remove"
          label={t('Remove')}
          variant={ButtonVariant.Secondary}
        />
      </div>

      <DeployButton entity={entity} />
    </div>
  );
};
