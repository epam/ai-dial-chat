import { FormProvider, useForm } from 'react-hook-form';

import { ApiApplicationResponseDefault } from '@/src/types/applications';

import { DEFAULT_VERSION } from '@/src/constants/public';

import { GeneralInfoEditor } from './GeneralInfoEditor';
import { GeneralInfoPreview, getPreviewEntityData } from './GeneralInfoPreview';
import { ApplicationGeneralInfoFormData } from './form';

interface Props {
  applicationData?: ApiApplicationResponseDefault;
}

export const GeneralInfoView: React.FC<Props> = ({ applicationData }) => {
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
    },
  });

  const formData = methods.watch();

  return (
    <div className="flex size-full">
      <div className="w-1/2">
        <FormProvider {...methods}>
          <GeneralInfoEditor isEdit={!!applicationData} />
        </FormProvider>
      </div>
      <div className="w-1/2">
        <GeneralInfoPreview data={getPreviewEntityData(formData)} />
      </div>
    </div>
  );
};
