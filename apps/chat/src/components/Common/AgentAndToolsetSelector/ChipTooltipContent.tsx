import { useTranslation } from 'next-i18next';

import { isApplicationId, isToolsetId } from '@/src/utils/app/id';

import { EntityType } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { EntityMarkdownDescription } from '../MarkdownDescription';

interface StatusMessageProps {
  id: string;
  item?: MarketplaceEntity;
  isInvalid: boolean;
  isLoggedOut: boolean;
}

const StatusMessage: React.FC<StatusMessageProps> = ({
  id,
  item,
  isInvalid,
  isLoggedOut,
}) => {
  const { t } = useTranslation(Translation.Common);

  if (isInvalid) {
    const isToolset = isToolsetId(id);
    const isApplication = isApplicationId(id);

    let entityTypeKey: 'entity' | 'toolset' | 'agent' = 'entity';
    if (isToolset) {
      entityTypeKey = 'toolset';
    } else if (isApplication) {
      entityTypeKey = 'agent';
    }

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
        {t('Logged out toolset. Click on the toolset to log in.')}
      </div>
    );
  }

  if (
    item?.type === EntityType.Model ||
    item?.type === EntityType.Application
  ) {
    return (
      <div className="text-sm text-secondary">
        {t('Click on the agent to see details.')}
      </div>
    );
  }

  return null;
};

interface ChipTooltipContentProps {
  id: string;
  item?: MarketplaceEntity;
  name: string;
  version?: string;
  isInvalid: boolean;
  isLoggedOut: boolean;
  hideStatusMessage?: boolean;
}

export const ChipTooltipContent: React.FC<ChipTooltipContentProps> = ({
  id,
  item,
  name,
  version,
  isInvalid,
  isLoggedOut,
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
        />
      )}

      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col text-sm">
          <span className="w-full truncate">{name}</span>
          <span>{t('v. {{version}}', { version })}</span>
        </div>
      </div>

      {!isInvalid && !isLoggedOut && item?.description && (
        <EntityMarkdownDescription
          className="line-clamp-3 text-sm leading-4 text-secondary"
          isShortDescription
        >
          {item.description}
        </EntityMarkdownDescription>
      )}
    </div>
  );
};
