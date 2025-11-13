import { useMemo } from 'react';

import router from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import { AddMarketplaceEntityMenuItem } from '@/src/types/menu';
import { ToolsetEditorSteps } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { ToolsetActions } from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';

import { Routes } from '@/src/constants/routes';
import { ToolsetEditorQuery } from '@/src/constants/toolsets';

import { AddMarketplaceEntityButton } from './AddMarketplaceEntityButton';

import { FeatureType } from '@epam/ai-dial-shared';

export function AddToolsButton() {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

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
            dispatch(ToolsetActions.setEditorStep(ToolsetEditorSteps.General));
            dispatch(ToolsetActions.clearToolsetDetails());
            void router.push({
              pathname: Routes.ToolsetEditor,
              query: {
                [ToolsetEditorQuery.ReturnUrl]:
                  window.location.pathname + window.location.search,
                [ToolsetEditorQuery.IsCreate]: true,
              },
            });
          },
        },
      ].sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1)),
    [t, dispatch],
  );

  return (
    <AddMarketplaceEntityButton
      dataQa="add-toolset"
      label="toolset"
      menuItems={menuItems}
    />
  );
}
