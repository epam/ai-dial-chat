import React from 'react';

import { useTranslation } from 'next-i18next';

import { useHasDeployAccess } from '@/src/hooks/useHasDeployAccess';

import { isMarketplaceEntityPublic } from '@/src/utils/app/application';
import { isToolsetId } from '@/src/utils/app/id';
import { getEntityStatus } from '@/src/utils/marketplace';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { CommonI18nKeys } from '@/src/constants/i18n';

interface StatusMessageProps {
  id: string;
  item?: MarketplaceEntity;
  isInSelectionList?: boolean;
  isCustomTool?: boolean;
  readonly?: boolean;
}

export const StatusMessage: React.FC<StatusMessageProps> = ({
  id,
  item,
  isInSelectionList,
  isCustomTool,
  readonly,
}) => {
  const { t } = useTranslation(Translation.Common);

  const {
    isInvalid,
    isLoggedOut,
    isUndeployed,
    isDeploying,
    isUndeploying,
    isRedeploying,
  } = getEntityStatus(item);

  let entityTypeKey: 'agent' | 'toolset' = 'agent';
  if (isToolsetId(id)) {
    entityTypeKey = 'toolset';
  }

  if (isCustomTool) {
    return (
      <div className="text-sm text-secondary">
        {t(CommonI18nKeys.AgentNotAvailableOnMarketplace)}
      </div>
    );
  }

  if (isInvalid) {
    const messageKey = readonly
      ? CommonI18nKeys.NotAvailableEntityType
      : CommonI18nKeys.NotAvailableEntityTypePleaseChange;

    return (
      <div className="text-sm text-error">
        {t(messageKey, { entityType: t(entityTypeKey) })}
      </div>
    );
  }

  if (isLoggedOut) {
    const message = readonly
      ? CommonI18nKeys.LoggedOutToolset
      : isInSelectionList
        ? CommonI18nKeys.LoggedOutToolsetClickToScroll
        : CommonI18nKeys.LoggedOutToolsetClickOn;

    return <div className="text-sm text-error">{t(message)}</div>;
  }

  const hasDeployAccess = useHasDeployAccess(item);
  const isPublicApp = item ? isMarketplaceEntityPublic(item) : false;

  if (isUndeployed) {
    let message: string;
    if (readonly) {
      message = CommonI18nKeys.UndeployedApp;
    } else if (!hasDeployAccess) {
      if (isPublicApp) {
        message = CommonI18nKeys.UndeployedAppAskAdmin;
      } else {
        message = CommonI18nKeys.UndeployedAppAskAuthor;
      }
    } else {
      message = isInSelectionList
        ? CommonI18nKeys.UndeployedAppClickToScroll
        : CommonI18nKeys.UndeployedAppClickOn;
    }

    return <div className="text-sm text-error">{t(message)}</div>;
  }

  const textTemplate = !readonly
    ? isInSelectionList
      ? CommonI18nKeys.ClickToScrollToEntityType
      : CommonI18nKeys.ClickOnEntityTypeToSeeDetails
    : '';

  if (isDeploying) {
    return (
      <div className="text-sm text-secondary">
        {t(CommonI18nKeys.DeployingApp)}
        {textTemplate &&
          ` ${t(textTemplate, { entityType: t(entityTypeKey) })}`}
      </div>
    );
  }

  if (isUndeploying) {
    return (
      <div className="text-sm text-secondary">
        {t(CommonI18nKeys.UndeployingApp)}
        {textTemplate &&
          ` ${t(textTemplate, { entityType: t(entityTypeKey) })}`}
      </div>
    );
  }

  if (isRedeploying) {
    return (
      <div className="text-sm text-secondary">
        {t(CommonI18nKeys.RedeployingApp)}
        {textTemplate &&
          ` ${t(textTemplate, { entityType: t(entityTypeKey) })}`}
      </div>
    );
  }

  return (
    <div className="text-sm text-secondary">
      {t(textTemplate, { entityType: t(entityTypeKey) })}
    </div>
  );
};
