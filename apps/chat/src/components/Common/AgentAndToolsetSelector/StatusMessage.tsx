import { useTranslation } from 'next-i18next';

import { isToolsetId } from '@/src/utils/app/id';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

interface StatusMessageProps {
  id: string;
  item?: MarketplaceEntity;
  isInvalid: boolean;
  isLoggedOut: boolean;
  isInSelectionList?: boolean;
  readonly?: boolean;
}

export const StatusMessage: React.FC<StatusMessageProps> = ({
  id,
  isInvalid,
  isLoggedOut,
  isInSelectionList,
  readonly,
}) => {
  const { t } = useTranslation(Translation.Common);

  let entityTypeKey: 'agent' | 'toolset' = 'agent';
  if (isToolsetId(id)) {
    entityTypeKey = 'toolset';
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
    return (
      <div className="text-sm text-error">
        {t(
          `Logged out toolset. Click ${isInSelectionList ? 'to scroll to' : 'on'} the toolset to log in.`,
        )}
      </div>
    );
  }

  const textTemplate = isInSelectionList
    ? 'Click to scroll to the {{entityType}}.'
    : 'Click on the {{entityType}} to see details.';

  return (
    <div className="text-sm text-secondary">
      {t(textTemplate, { entityType: t(entityTypeKey) })}
    </div>
  );
};
