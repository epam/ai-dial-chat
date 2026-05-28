import React from 'react';

import { useTranslation } from 'next-i18next';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { CommonI18nKeys } from '@/src/constants/i18n';

import { StatusMessage } from './StatusMessage';

interface ChipTooltipContentProps {
  id: string;
  item?: MarketplaceEntity;
  name: string;
  version?: string;
  isInSelectionList?: boolean;
  isCustomTool?: boolean;
  readonly?: boolean;
}

export const ChipTooltipContent: React.FC<ChipTooltipContentProps> = ({
  id,
  item,
  name,
  version,
  isInSelectionList,
  isCustomTool,
  readonly,
}) => {
  const { t } = useTranslation(Translation.Common);

  return (
    <div className="flex max-w-[440px] flex-col px-2 py-1">
      <StatusMessage
        id={id}
        item={item}
        isInSelectionList={isInSelectionList}
        isCustomTool={isCustomTool}
        readonly={readonly}
      />

      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col text-sm">
          <span className="w-full truncate">{name}</span>
          {version && (
            <span>{t(CommonI18nKeys.VersionShort, { version })}</span>
          )}
        </div>
      </div>
    </div>
  );
};
