import { FormProvider, useForm } from 'react-hook-form';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import { ApiApplicationResponseDefault } from '@/src/types/applications';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { GeneralInfoEditor } from './GeneralInfoEditor';
import { GeneralInfoPreview, getPreviewEntityData } from './GeneralInfoPreview';
import { ApplicationGeneralInfoFormData, getDefaultValues } from './form';

interface Props {
  applicationData?: ApiApplicationResponseDefault;
  schema: ApiDetailedApplicationTypeSchema | null;
  bucket: string;
}

export const GeneralInfoView: React.FC<Props> = ({
  applicationData,
  schema,
  bucket,
}) => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const modelFromState = applicationData
    ? modelsMap[applicationData.reference]
    : null;

  const [pythonVersion] = useAppSelector(
    SettingsSelectors.selectCodeEditorPythonVersions,
  );

  const models = useAppSelector(ModelsSelectors.selectModels);
  const modelsWithFolderId = models.map((model) => ({
    ...model,
    folderId: '',
  }));

  const methods = useForm<ApplicationGeneralInfoFormData>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: getDefaultValues(
      applicationData,
      bucket,
      pythonVersion,
      modelsWithFolderId,
    ),
  });

  const formData = methods.watch();

  return (
    <div className="flex size-full">
      <div className="w-1/2">
        <FormProvider {...methods}>
          <GeneralInfoEditor
            isEdit={!!applicationData}
            schema={schema}
            isSharedWithMe={modelFromState?.sharedWithMe ?? false}
          />
        </FormProvider>
      </div>
      <div className="w-1/2">
        <GeneralInfoPreview data={getPreviewEntityData(formData)} />
      </div>
    </div>
  );
};
