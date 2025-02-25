import { FormProvider, useForm } from 'react-hook-form';

import { getApplicationEntityFields } from '@/src/utils/app/application';
import { BucketService } from '@/src/utils/app/data/bucket-service';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import {
  ApplicationStatus,
  CustomApplicationModel,
} from '@/src/types/applications';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { GeneralInfoEditor } from './GeneralInfoEditor';
import { GeneralInfoPreview } from './GeneralInfoPreview';
import { ApplicationGeneralInfoFormData, getDefaultValues } from './form';

interface Props {
  applicationData?: CustomApplicationModel;
  schema: ApiDetailedApplicationTypeSchema | null;
}

export const GeneralInfoView: React.FC<Props> = ({
  applicationData,
  schema,
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

  const isAppDeployed =
    applicationData?.function?.status === ApplicationStatus.DEPLOYED;

  const methods = useForm<ApplicationGeneralInfoFormData>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: getDefaultValues(
      applicationData,
      BucketService.getBucket(),
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
            oldApplication={applicationData ? applicationData : undefined}
            schema={schema}
            isSharedWithMe={modelFromState?.sharedWithMe ?? false}
            isAppDeployed={isAppDeployed}
          />
        </FormProvider>
      </div>
      <div className="w-1/2">
        <GeneralInfoPreview data={getApplicationEntityFields(formData)} />
      </div>
    </div>
  );
};
