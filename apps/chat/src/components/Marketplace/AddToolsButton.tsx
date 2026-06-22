import React, { useMemo } from 'react';

import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import { AddMarketplaceEntityMenuItem } from '@/src/types/menu';
import { ToolsetEditorSteps } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { ToolsetActions } from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';
import { QUERY_VALUE_TRUE, Routes } from '@/src/constants/routes';
import { ToolsetEditorQuery } from '@/src/constants/toolsets';

import { AddMarketplaceEntityButton } from './AddMarketplaceEntityButton';

import { FeatureType } from '@epam/ai-dial-shared';

export function AddToolsButton() {
  const router = useRouter();
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const toolsetEntityLabel = t(MarketplaceI18nKeys.ToolsetEntity);

  const menuItems: AddMarketplaceEntityMenuItem[] = useMemo(
    () =>
      [
        {
          name: t(MarketplaceI18nKeys.ToolsetMarketplace),
          dataQa: 'add-toolset',
          type: FeatureType.Toolset,
          display: true,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            dispatch(ToolsetActions.setToolsetDetails());
            dispatch(ToolsetActions.setEditorStep(ToolsetEditorSteps.General));
            void router.push({
              pathname: Routes.ToolsetEditor,
              query: {
                [ToolsetEditorQuery.ReturnUrl]:
                  window.location.pathname + window.location.search,
                [ToolsetEditorQuery.IsCreating]: QUERY_VALUE_TRUE,
              },
            });
          },
        },
      ].sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1)),
    [t, dispatch, router],
  );

  return (
    <AddMarketplaceEntityButton
      dataQa="add-toolset"
      label={toolsetEntityLabel}
      menuItems={menuItems}
    />
  );
}
