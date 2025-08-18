import { useMemo } from 'react';

import router from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import { AddMarketplaceEntityMenuItem } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { Routes } from '@/src/constants/routes';

import { AddMarketplaceEntityButton } from './AddMarketplaceEntityButton';

import { FeatureType } from '@epam/ai-dial-shared';

export function AddToolsButton() {
  const { t } = useTranslation(Translation.Marketplace);

  const menuItems: AddMarketplaceEntityMenuItem[] = useMemo(
    () =>
      [
        {
          name: t('Toolset'),
          dataQa: 'add-toolset',
          type: FeatureType.Toolset,
          display: true,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            router.push(Routes.ToolsetEditor);
          },
        },
      ].sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1)),
    [t],
  );

  return (
    <AddMarketplaceEntityButton
      dataQa="add-toolset"
      label="toolset"
      menuItems={menuItems}
    />
  );
}
