import {
  IconCloudDownload,
  IconCloudUpload,
  IconRefresh,
} from '@tabler/icons-react';

import { useApplicationStatusActions } from '@/src/hooks/useApplicationStatusActions';
import { useHasDeployAccess } from '@/src/hooks/useHasDeployAccess';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  isApplicationDeployed,
  isApplicationDeploymentInProgress,
  isExecutableApp,
} from '@/src/utils/app/application';

import { ApplicationStatus } from '@/src/types/applications';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import { Spinner } from '@/src/components/Common/Spinner';

import { ApplicationDetailsFooterProps } from './ApplicationDetails';

import { DialNeutralButton, DialPrimaryButton } from '@epam/ai-dial-ui-kit';

interface ActionButtonProps {
  entity: DialAIEntityModel;
}

const DeployUndeployButton = ({ entity }: ActionButtonProps) => {
  const { t } = useTranslation(Translation.Marketplace);
  const { handleDeploy, handleUndeploy } = useApplicationStatusActions(
    entity.id,
  );

  const hasDeployAccess = useHasDeployAccess(entity);

  const isAppDeployed = isApplicationDeployed(entity);
  const isAppDeploymentInProgress = isApplicationDeploymentInProgress(entity);
  const isDeploying = entity.functionStatus === ApplicationStatus.DEPLOYING;
  const isRedeploying = entity.functionStatus === ApplicationStatus.REDEPLOYING;
  const buttonStatus = isDeploying
    ? t(MarketplaceI18nKeys.DeployingMarketplace)
    : isRedeploying
      ? t(MarketplaceI18nKeys.RedeployingMarketplace)
      : t(MarketplaceI18nKeys.UndeployingMarketplace);

  if (!isExecutableApp(entity) || !hasDeployAccess) {
    return null;
  }

  if (isAppDeploymentInProgress) {
    return (
      <DialNeutralButton
        label={buttonStatus}
        iconBefore={<Spinner size={18} className="!text-controls-disable" />}
        data-qa="deploy-pending"
        disabled
      />
    );
  }

  if (isAppDeployed) {
    return (
      <DialNeutralButton
        label={t(MarketplaceI18nKeys.UndeployMarketplace)}
        iconBefore={<IconCloudDownload size={18} />}
        onClick={handleUndeploy}
        data-qa="undeploy-in-details"
      />
    );
  }

  return (
    <DialPrimaryButton
      label={t(MarketplaceI18nKeys.DeployMarketplace)}
      iconBefore={<IconCloudUpload size={18} />}
      onClick={handleDeploy}
      data-qa="deploy-in-details"
    />
  );
};

const RedeployButton = ({ entity }: ActionButtonProps) => {
  const { t } = useTranslation(Translation.Marketplace);
  const { handleRedeploy } = useApplicationStatusActions(entity.id);

  const hasDeployAccess = useHasDeployAccess(entity);

  const isAppDeployed = isApplicationDeployed(entity);
  const isAppDeploymentInProgress = isApplicationDeploymentInProgress(entity);

  if (!isAppDeployed || isAppDeploymentInProgress || !hasDeployAccess) {
    return null;
  }

  return (
    <DialNeutralButton
      label={t(MarketplaceI18nKeys.Redeploy)}
      iconBefore={<IconRefresh size={18} />}
      onClick={handleRedeploy}
      data-qa="redeploy-in-details"
    />
  );
};

export const SimpleApplicationDetailsFooter = ({
  entity,
  onChangeVersion,
}: ApplicationDetailsFooterProps) => {
  return (
    <div className="flex items-center justify-end gap-3 p-4 sm:gap-4">
      <ModelVersionSelect
        className="h-max"
        entities={[entity]}
        showVersionPrefix
        onSelect={onChangeVersion}
        currentEntity={entity}
      />
      <div className="flex items-center gap-2 sm:gap-3">
        <DeployUndeployButton entity={entity} />
        <RedeployButton entity={entity} />
      </div>
    </div>
  );
};
