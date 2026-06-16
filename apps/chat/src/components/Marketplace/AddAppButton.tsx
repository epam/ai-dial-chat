import React, { useCallback, useMemo } from 'react';

import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getAppEditorCreateModeRoute } from '@/src/utils/app/route';

import { ApplicationTypeSchema } from '@/src/types/application-type-schema';
import { ApplicationType } from '@/src/types/applications';
import { MarketplaceEditorSteps } from '@/src/types/marketplace';
import { AddMarketplaceEntityMenuItem } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ApplicationTypesSchemasActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationTypesSchemasSelectors,
  SettingsSelectors,
} from '@/src/store/selectors';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';

import { AddMarketplaceEntityButton } from './AddMarketplaceEntityButton';

import { Feature } from '@epam/ai-dial-shared';

export function AddAppButton() {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Marketplace);

  const router = useRouter();

  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const applicationTypeSchemas = useAppSelector(
    ApplicationTypesSchemasSelectors.selectAllSchemas,
  );

  const isCodeAppsEnabled = enabledFeatures.has(Feature.CodeApps);
  const hideCustomAppCreation = enabledFeatures.has(
    Feature.HideCustomAppCreation,
  );

  const openEditor = useCallback(
    (type: string) => {
      void router.push(getAppEditorCreateModeRoute(type));
      dispatch(ApplicationActions.setAppDetails());
      dispatch(
        ApplicationActions.setEditorStep(MarketplaceEditorSteps.General),
      );
    },
    [router, dispatch],
  );

  const appEntityLabel = t(MarketplaceI18nKeys.AppEntity);

  const menuItems: AddMarketplaceEntityMenuItem[] = useMemo(
    () =>
      [
        {
          name: t(MarketplaceI18nKeys.CustomApp),
          type: ApplicationType.CUSTOM_APP,
          dataQa: 'add-custom-app',
          display: !hideCustomAppCreation,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            dispatch(
              ApplicationTypesSchemasActions.resetDetailedApplicationTypeSchema(),
            );
            openEditor(ApplicationType.CUSTOM_APP);
          },
        },
        {
          name: t(MarketplaceI18nKeys.CodeApp),
          dataQa: 'add-startable-app',
          type: ApplicationType.CODE_APP,
          display: isCodeAppsEnabled,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            dispatch(
              ApplicationTypesSchemasActions.resetDetailedApplicationTypeSchema(),
            );
            openEditor(ApplicationType.CODE_APP);
          },
        },
        ...(applicationTypeSchemas?.map((schema: ApplicationTypeSchema) => ({
          name: schema.displayName,
          type: schema.displayName,
          dataQa: `add-${schema.displayName}`,
          display: true,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            dispatch(
              ApplicationTypesSchemasActions.fetchDetailedApplicationTypeSchema(
                schema.id,
              ),
            );
            openEditor(schema.id);
          },
        })) ?? []),
      ].sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1)),
    [
      t,
      hideCustomAppCreation,
      isCodeAppsEnabled,
      applicationTypeSchemas,
      dispatch,
      openEditor,
    ],
  );

  return (
    <AddMarketplaceEntityButton
      dataQa="add-app"
      label={appEntityLabel}
      menuItems={menuItems}
    />
  );
}
