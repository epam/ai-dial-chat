import { useMemo } from 'react';

import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getAppEditorRoute } from '@/src/utils/app/route';

import { ApplicationTypeSchema } from '@/src/types/application-type-schema';
import { ApplicationType } from '@/src/types/applications';
import { AddMarketplaceEntityMenuItem } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { ApplicationTypesSchemasActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationTypesSchemasSelectors,
  SettingsSelectors,
} from '@/src/store/selectors';

import { AddMarketplaceEntityButton } from './AddMarketplaceEntityButton';

import { Feature } from '@epam/ai-dial-shared';

export function AddAppButton() {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Marketplace);

  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  const router = useRouter();

  const isCodeAppsEnabled = enabledFeatures.has(Feature.CodeApps);

  const applicationTypeSchemas = useAppSelector(
    ApplicationTypesSchemasSelectors.selectAllSchemas,
  );
  const detailedApplicationTypeSchema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );

  const menuItems: AddMarketplaceEntityMenuItem[] = useMemo(
    () =>
      [
        {
          name: t('Custom app'),
          type: ApplicationType.CUSTOM_APP,
          dataQa: 'add-custom-app',
          display: true,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            void router.push(getAppEditorRoute(ApplicationType.CUSTOM_APP));
          },
        },
        {
          name: t('Code app'),
          dataQa: 'add-startable-app',
          type: ApplicationType.CODE_APP,
          display: isCodeAppsEnabled,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            void router.push(getAppEditorRoute(ApplicationType.CODE_APP));
          },
        },
        ...(applicationTypeSchemas?.map((schema: ApplicationTypeSchema) => ({
          name: t(schema.displayName),
          type: schema.displayName,
          dataQa: `add-${schema.displayName}`,
          display: true,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            if (detailedApplicationTypeSchema?.$id !== schema.id) {
              dispatch(
                ApplicationTypesSchemasActions.fetchDetailedApplicationTypeSchema(
                  schema.id,
                ),
              );
            }
            void router.push(getAppEditorRoute(schema.id));
          },
        })) ?? []),
      ].sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1)),
    [
      t,
      isCodeAppsEnabled,
      applicationTypeSchemas,
      dispatch,
      router,
      detailedApplicationTypeSchema?.$id,
    ],
  );

  return (
    <AddMarketplaceEntityButton
      dataQa="add-app"
      label="App"
      menuItems={menuItems}
    />
  );
}
