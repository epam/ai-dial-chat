import { useTranslation } from 'next-i18next';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { StatusMessage } from './StatusMessage';

interface ChipTooltipContentProps {
  id: string;
  item?: MarketplaceEntity;
  name: string;
  version?: string;
  isInvalid: boolean;
  isLoggedOut: boolean;
  isUndeployed: boolean;
  isInSelectionList?: boolean;
  readonly?: boolean;
}

export const ChipTooltipContent: React.FC<ChipTooltipContentProps> = ({
  id,
  item,
  name,
  version,
  isInvalid,
  isLoggedOut,
  isUndeployed,
  isInSelectionList,
  readonly,
}) => {
  const { t } = useTranslation(Translation.Common);

  return (
    <div className="flex max-w-[440px] flex-col px-2 py-1">
      <StatusMessage
        id={id}
        item={item}
        isInvalid={isInvalid}
        isLoggedOut={isLoggedOut}
        isUndeployed={isUndeployed}
        isInSelectionList={isInSelectionList}
        readonly={readonly}
      />

      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col text-sm">
          <span className="w-full truncate">{name}</span>
          {version && <span>{t('v. {{version}}', { version })}</span>}
        </div>
      </div>
    </div>
  );
};
