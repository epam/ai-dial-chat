import { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { LocalesService } from '@/src/utils/app/data/locales-service';
import { getEntityPayloadFromLocals } from '@/src/utils/app/marketplace-localization';

import { CustomApplicationModel } from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import { MarketplaceEditorSteps } from '@/src/types/marketplace';

import { useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ApplicationTypesSchemasSelectors,
  ModelsSelectors,
} from '@/src/store/selectors';

import { DRAFT_APPLICATION_ID } from '@/src/constants/applications';

import { GeneralPreview } from '@/src/components/AppsEditor/AppEditorPreview/GeneralPreview';
import { SettingsPreview } from '@/src/components/AppsEditor/AppEditorPreview/SettingsPreview';
import { AppsEditorFormType } from '@/src/components/AppsEditor/form';

interface AppEditorPreviewProps {
  onSave: () => void;
}

export const AppEditorPreview = ({ onSave }: AppEditorPreviewProps) => {
  const editorStep = useAppSelector(ApplicationSelectors.selectEditorStep);
  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const schema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );
  const model = appDetails ? modelsMap[appDetails.reference] : undefined;

  const { control } = useFormContext<AppsEditorFormType>();
  const [name, version, description, iconUrl, topics, locales] = useWatch({
    name: ['name', 'version', 'description', 'iconUrl', 'topics', 'locales'],
    control,
  });

  const { name: nameLocales, description: descriptionLocales } = useMemo(
    () => getEntityPayloadFromLocals(locales),
    [locales],
  );

  const entity: Omit<CustomApplicationModel, 'folderId'> = useMemo(
    () => ({
      name: { [LocalesService.getPrimaryLocale()]: name, ...nameLocales },
      description: {
        [LocalesService.getPrimaryLocale()]: description,
        ...descriptionLocales,
      },
      version,
      iconUrl,
      topics,
      reference: '',
      features: undefined,
      id: appDetails?.id ?? DRAFT_APPLICATION_ID,
      completionUrl: '',
      type: EntityType.Application,
      isDefault: true,
      owner: model?.owner,
      createdAt: model?.createdAt,
      applicationTypeSchemaId: schema?.$id ?? '',
    }),
    [
      model?.createdAt,
      appDetails?.id,
      model?.owner,
      description,
      iconUrl,
      name,
      schema?.$id,
      topics,
      version,
      nameLocales,
      descriptionLocales,
    ],
  );

  switch (editorStep) {
    case MarketplaceEditorSteps.Settings:
      return <SettingsPreview onSave={onSave} />;
    case MarketplaceEditorSteps.General:
    default:
      return <GeneralPreview entity={entity} />;
  }
};
