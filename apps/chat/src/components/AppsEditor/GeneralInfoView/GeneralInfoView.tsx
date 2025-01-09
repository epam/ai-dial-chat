import { FormProvider, useForm } from 'react-hook-form';

import { isApplicationType } from '@/src/utils/app/application';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import { ApiApplicationResponseDefault } from '@/src/types/applications';

import { DEFAULT_VERSION } from '@/src/constants/public';

import { GeneralInfoEditor } from './GeneralInfoEditor';
import { GeneralInfoPreview, getPreviewEntityData } from './GeneralInfoPreview';
import { ApplicationGeneralInfoFormData } from './form';

interface Props {
  applicationData?: ApiApplicationResponseDefault;
  schema: ApiDetailedApplicationTypeSchema | null;
}

export const GeneralInfoView: React.FC<Props> = ({
  applicationData,
  schema,
}) => {
  const methods = useForm<ApplicationGeneralInfoFormData>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      name: applicationData?.display_name ?? '',
      version: applicationData?.display_version ?? DEFAULT_VERSION,
      iconUrl: applicationData?.icon_url ?? '',
      description: applicationData?.description ?? '',
      topics:
        applicationData?.description_keywords?.filter(
          (value) => !isApplicationType(value),
        ) ?? [],
      id: applicationData?.name ?? '',
      reference: applicationData?.reference ?? '',
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
