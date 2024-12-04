import { FormProvider, useForm } from 'react-hook-form';

import {
  ApiApplicationResponseDefault,
  ApplicationSlug,
} from '@/src/types/applications';

import {
  GeneralInfoPreview,
  getPreviewEntityData,
} from '../GeneralInfoView/GeneralInfoPreview';
import { ApplicationView } from './ApplicationView';
import { MindmapView } from './MindmapView';
import { MindmapPreview } from './Previews/MindmapPreview';
import {
  CustomApplicationFormData,
  getCustomApplicationDefaultValues,
} from './form';

interface Props {
  type: ApplicationSlug;
  applicationData: ApiApplicationResponseDefault;
  currentProviderId: string;
}

export const ApplicationSettings: React.FC<Props> = ({
  type,
  applicationData,
  currentProviderId,
}) => {
  const getDefaultValues = (type: ApplicationSlug) => {
    switch (type) {
      case ApplicationSlug.CUSTOM_APP:
        return getCustomApplicationDefaultValues({ app: applicationData });
      default:
        return {};
    }
  };

  const getFormView = (type?: ApplicationSlug) => {
    switch (type) {
      case ApplicationSlug.CUSTOM_APP:
        return <ApplicationView />;
      case ApplicationSlug.MINDMAP_APP:
        return (
          <MindmapView
            id={applicationData.name}
            currentProviderId={currentProviderId}
          />
        );
      default:
        return <pre>{JSON.stringify(applicationData, null, 2)}</pre>;
    }
  };

  const getPreview = (
    type: ApplicationSlug,
    data: CustomApplicationFormData,
  ) => {
    switch (type) {
      case ApplicationSlug.MINDMAP_APP:
        return (
          <MindmapPreview
            id={applicationData.name}
            currentProviderId={currentProviderId}
          />
        );
      default:
        return <GeneralInfoPreview data={getPreviewEntityData(data)} />;
    }
  };

  const methods = useForm<CustomApplicationFormData>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: getDefaultValues(type),
  });

  const formData = methods.watch();
  return (
    <div className="flex size-full">
      <div className="w-1/2">
        <FormProvider {...methods}>{getFormView(type)}</FormProvider>
      </div>
      <div className="w-1/2">{getPreview(type, formData)}</div>
    </div>
  );
};
