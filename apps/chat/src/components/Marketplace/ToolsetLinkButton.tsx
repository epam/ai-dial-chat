import React, { FC } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getMarketplaceEntityMcpUrl } from '@/src/utils/app/marketplace';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { CommonI18nKeys } from '@/src/constants/i18n';

import { CopyButton } from '@/src/components/Buttons/CopyButton';

interface ToolsetLinkButtonProps {
  entity?: MarketplaceEntity;
}

export const ToolsetLinkButton: FC<ToolsetLinkButtonProps> = ({ entity }) => {
  const { t } = useTranslation(Translation.Common);
  const { dialCoreExternalUrl } = useAppSelector(
    SettingsSelectors.selectDefaults,
  );

  if (!dialCoreExternalUrl || !entity) return null;

  return (
    <CopyButton
      copyContent={getMarketplaceEntityMcpUrl(entity)}
      copyLabel={t(CommonI18nKeys.CopyURL)}
      copiedLabel={t(CommonI18nKeys.Copied)}
    />
  );
};
