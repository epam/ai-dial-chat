import { FormProvider, useForm } from 'react-hook-form';

import { GeneralInfoEditor } from './GeneralInfoEditor';
import { GeneralInfoPreview } from './GeneralInfoPreview';
import { FormData } from './form';

export const GeneralInfoView = () => {
  const methods = useForm<FormData>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      version: '',
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
        <GeneralInfoPreview data={formData} />
      </div>
    </div>
  );
};
