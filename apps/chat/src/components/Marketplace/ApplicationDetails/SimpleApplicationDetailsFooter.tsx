import {
  IconPlayerPlay,
  IconPlaystationSquare,
  IconRefresh,
} from '@tabler/icons-react';
import { useCallback } from 'react';

import { useApplicationStatusActions } from '@/src/hooks/useApplicationStatusActions';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  isApplicationDeployed,
  isApplicationDeploymentInProgress,
  isExecutableApp,
} from '@/src/utils/app/application';

import { ApplicationStatus } from '@/src/types/applications';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import { Spinner } from '@/src/components/Common/Spinner';

import { ApplicationDetailsFooterProps } from './ApplicationDetails';

import { DialNeutralButton, DialPrimaryButton } from '@epam/ai-dial-ui-kit';

interface ActionButtonProps {
  entity: DialAIEntityModel;
}

export const DeployUndeployButton = ({ entity }: ActionButtonProps) => {
  const { t } = useTranslation(Translation.Marketplace);
  const { handleDeploy, handleUndeploy } = useApplicationStatusActions(
    entity.id,
  );

  const isAppDeployed = isApplicationDeployed(entity);
  const isAppDeploymentInProgress = isApplicationDeploymentInProgress(entity);
  const isDeploying =
    entity.functionStatus === ApplicationStatus.DEPLOYING ||
    entity.functionStatus === ApplicationStatus.REDEPLOYING;

  if (!isExecutableApp(entity)) {
    return null;
  }

  if (isAppDeploymentInProgress) {
    return (
      <DialNeutralButton
        label={isDeploying ? t('Deploying') : t('Undeploying')}
        iconBefore={<Spinner size={18} className="!text-controls-disable" />}
        data-qa="deploy-pending"
        disabled
      />
    );
  }

  if (isAppDeployed) {
    return (
      <DialNeutralButton
        label={t('Undeploy')}
        iconBefore={<IconPlaystationSquare size={18} />}
        onClick={handleUndeploy}
        data-qa="undeploy-in-details"
      />
    );
  }

  return (
    <DialPrimaryButton
      label={t('Deploy')}
      iconBefore={<IconPlayerPlay size={18} />}
      onClick={handleDeploy}
      data-qa="deploy-in-details"
    />
  );
};

export const RedeployButton = ({ entity }: ActionButtonProps) => {
  const { t } = useTranslation(Translation.Marketplace);
  const { handleRedeploy } = useApplicationStatusActions(entity.id);

  const isAppDeployed = isApplicationDeployed(entity);
  const isAppDeploymentInProgress = isApplicationDeploymentInProgress(entity);

  if (!isAppDeployed || isAppDeploymentInProgress) {
    return null;
  }

  return (
    <DialPrimaryButton
      label={t('Redeploy')}
      iconBefore={<IconRefresh size={18} />}
      onClick={handleRedeploy}
      data-qa="redeploy-in-details"
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
        <DialNeutralButton
          onClick={handleRemove}
          data-qa="remove"
          label={t('Remove')}
        />
      </div>

      <DeployUndeployButton entity={entity} />
      <RedeployButton entity={entity} />
    </div>
  );
};
