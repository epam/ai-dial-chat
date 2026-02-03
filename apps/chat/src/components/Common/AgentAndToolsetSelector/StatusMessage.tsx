import { useTranslation } from 'next-i18next';

import { isToolsetId } from '@/src/utils/app/id';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

interface StatusMessageProps {
  id: string;
  item?: MarketplaceEntity;
  isInvalid: boolean;
  isLoggedOut: boolean;
  isUndeployed: boolean;
  isInSelectionList?: boolean;
  isCustomTool?: boolean;
  readonly?: boolean;
}

export const StatusMessage: React.FC<StatusMessageProps> = ({
  id,
  isInvalid,
  isLoggedOut,
  isUndeployed,
  isInSelectionList,
  isCustomTool,
  readonly,
}) => {
  const { t } = useTranslation(Translation.Common);

  let entityTypeKey: 'agent' | 'toolset' = 'agent';
  if (isToolsetId(id)) {
    entityTypeKey = 'toolset';
  }

  if (isCustomTool) {
    return (
      <div className="text-sm text-secondary">
        {t(
          'The agent is not available on the marketplace and was added via JSON',
        )}
      </div>
    );
  }

  if (isInvalid) {
    const messageKey = readonly
      ? 'Not available {{entityType}}.'
      : 'Not available {{entityType}}. Please, change or remove {{entityType}} to proceed.';

    return (
      <div className="text-sm text-error">
        {t(messageKey, { entityType: t(entityTypeKey) })}
      </div>
    );
  }

  if (isLoggedOut) {
    const message = readonly
      ? 'Logged out toolset.'
      : `Logged out toolset. Click ${
          isInSelectionList ? 'to scroll to' : 'on'
        } the toolset to log in.`;

    return <div className="text-sm text-error">{t(message)}</div>;
  }

  if (isUndeployed) {
    const message = readonly
      ? 'Undeployed app.'
      : `Undeployed app. Click ${
          isInSelectionList ? 'to scroll to' : 'on'
        } the app to deploy.`;

    return <div className="text-sm text-error">{t(message)}</div>;
  }

  const textTemplate = !readonly
    ? isInSelectionList
      ? 'Click to scroll to the {{entityType}}.'
      : 'Click on the {{entityType}} to see details.'
    : '';

  return (
    <div className="text-sm text-secondary">
      {t(textTemplate, { entityType: t(entityTypeKey) })}
    </div>
  );
};
