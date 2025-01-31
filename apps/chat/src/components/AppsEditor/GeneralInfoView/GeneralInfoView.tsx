import { FormProvider, useForm } from 'react-hook-form';

import { safeStringifyApplicationFeatures } from '@/src/utils/app/application';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import { ApiApplicationResponseDefault } from '@/src/types/applications';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import {
  FEATURES_ENDPOINTS,
  FEATURES_ENDPOINTS_DEFAULT_VALUES,
  FEATURES_ENDPOINTS_NAMES,
} from '@/src/constants/applications';
import { DEFAULT_VERSION } from '@/src/constants/public';

import { GeneralInfoEditor } from './GeneralInfoEditor';
import { GeneralInfoPreview, getPreviewEntityData } from './GeneralInfoPreview';
import { ApplicationGeneralInfoFormData } from './form';

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
  const [pythonVersion] = useAppSelector(
    SettingsSelectors.selectCodeEditorPythonVersions,
  );
  const methods = useForm<ApplicationGeneralInfoFormData>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      name: applicationData?.display_name ?? '',
      version: applicationData?.display_version ?? DEFAULT_VERSION,
      iconUrl: applicationData?.icon_url ?? '',
      description: applicationData?.description ?? '',
      topics: applicationData?.description_keywords ?? [],
      id: applicationData?.name ?? '',
      reference: applicationData?.reference ?? '',
      //schema type application properties
      applicationProperties: applicationData?.application_properties,
      //custom application properties
      completionUrl: applicationData?.endpoint,
      inputAttachmentTypes: applicationData?.input_attachment_types,
      maxInputAttachments: applicationData?.max_input_attachments,
      features: safeStringifyApplicationFeatures(applicationData?.features),
      //code app application properties
      sources:
        applicationData?.function?.source_folder ?? `files/${bucket}/appdata`,
      runtime:
        applicationData?.function?.runtime ?? pythonVersion ?? 'python3.11',
      endpoints: applicationData?.function?.mapping
        ? Object.entries(applicationData.function.mapping).map(
            ([key, value]) => ({
              label: key,
              visibleName: FEATURES_ENDPOINTS_NAMES[key],
              value,
              editableKey:
                !FEATURES_ENDPOINTS[key as keyof typeof FEATURES_ENDPOINTS],
              static: key === FEATURES_ENDPOINTS.chat_completion,
            }),
          )
        : [
            {
              label: FEATURES_ENDPOINTS.chat_completion,
              visibleName:
                FEATURES_ENDPOINTS_NAMES[FEATURES_ENDPOINTS.chat_completion],
              value:
                FEATURES_ENDPOINTS_DEFAULT_VALUES[
                  FEATURES_ENDPOINTS.chat_completion
                ] || '',
              editableKey: false,
              static: true,
            },
          ],
      env: applicationData?.function?.env
        ? Object.entries(applicationData.function.env).map(
            ([label, value]) => ({
              label,
              value,
              editableKey: true,
            }),
          )
        : [],
    },
  });

  const formData = methods.watch();

  return (
    <div className="flex size-full">
      <div className="w-1/2">
        <FormProvider {...methods}>
          <GeneralInfoEditor isEdit={!!applicationData} schema={schema} />
        </FormProvider>
      </div>
      <div className="w-1/2">
        <GeneralInfoPreview data={getPreviewEntityData(formData)} />
      </div>
    </div>
  );
};
