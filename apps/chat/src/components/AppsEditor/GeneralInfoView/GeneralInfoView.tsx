import { FormProvider, useForm } from 'react-hook-form';

import { DEFAULT_VERSION } from '@/src/constants/public';

import { GeneralInfoEditor } from './GeneralInfoEditor';
import { GeneralInfoPreview, getPreviewEntityData } from './GeneralInfoPreview';
import { ApplicationGeneralInfoFormData } from './form';

export const GeneralInfoView = () => {
  const methods = useForm<ApplicationGeneralInfoFormData>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      version: DEFAULT_VERSION,
      iconUrl: '',
      description: '',
      topics: [],
    },
  });

  const formData = methods.watch();

  return (
    <div className="flex size-full">
      <div className="w-1/2">
        <FormProvider {...methods}>
          <GeneralInfoEditor />
        </FormProvider>
      </div>
      <div className="w-1/2">
        <GeneralInfoPreview data={getPreviewEntityData(formData)} />
      </div>
    </div>
  );
};
