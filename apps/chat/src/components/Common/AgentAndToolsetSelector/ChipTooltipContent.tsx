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
}

const StatusMessage: React.FC<StatusMessageProps> = ({
  id,
  isInvalid,
  isLoggedOut,
  isInSelectionList,
}) => {
  const { t } = useTranslation(Translation.Common);

  let entityTypeKey: 'agent' | 'toolset' = 'agent';
  if (isToolsetId(id)) {
    entityTypeKey = 'toolset';
  }

  if (isInvalid) {
    return (
      <div className="text-sm text-error">
        {t(
          'Not available {{entityType}}. Please, change or remove {{entityType}} to proceed.',
          { entityType: t(entityTypeKey) },
        )}
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

interface ChipTooltipContentProps {
  id: string;
  item?: MarketplaceEntity;
  name: string;
  version?: string;
  isInvalid: boolean;
  isLoggedOut: boolean;
  isInSelectionList?: boolean;
  hideStatusMessage?: boolean;
}

export const ChipTooltipContent: React.FC<ChipTooltipContentProps> = ({
  id,
  item,
  name,
  version,
  isInvalid,
  isLoggedOut,
  isInSelectionList,
  hideStatusMessage,
}) => {
  const { t } = useTranslation(Translation.Common);

  return (
    <div className="flex max-w-[440px] flex-col px-2 py-1">
      {!hideStatusMessage && (
        <StatusMessage
          id={id}
          item={item}
          isInvalid={isInvalid}
          isLoggedOut={isLoggedOut}
          isInSelectionList={isInSelectionList}
        />
      )}

      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col text-sm">
          <span className="w-full truncate">{name}</span>
          {version && <span>{t('v. {{version}}', { version })}</span>}
        </div>
      </div>
    </div>
  );
};
