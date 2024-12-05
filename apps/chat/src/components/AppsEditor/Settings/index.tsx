import { FormProvider, useForm } from 'react-hook-form';

import { useRouter } from 'next/router';

import {
  ApiApplicationResponseDefault,
  ApplicationSlug,
} from '@/src/types/applications';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import {
  GeneralInfoPreview,
  getPreviewEntityData,
} from '../GeneralInfoView/GeneralInfoPreview';
import { ApplicationView } from './ApplicationView';
import { CodeAppView } from './CodeAppView';
import { MindmapView } from './MindmapView';
import { MindmapPreview } from './Previews/MindmapPreview';
import { QuickAppView } from './QuickAppView';
import {
  CustomApplicationFormData,
  QuickAppFormData,
  getCodeAppDefaultValues,
  getCustomApplicationDefaultValues,
  getQuickAppDefaultValues,
} from './form';

interface Props {
  type: ApplicationSlug;
  applicationData: ApiApplicationResponseDefault;
  currentProviderId: string;
  frontendHost: string | null;
}

export const ApplicationSettings: React.FC<Props> = ({
  type,
  applicationData,
  currentProviderId,
  frontendHost,
}) => {
  const router = useRouter();
  const pythonVersions = useAppSelector(
    SettingsSelectors.selectCodeEditorPythonVersions,
  );

  const getDefaultValues = (type: ApplicationSlug) => {
    switch (type) {
      case ApplicationSlug.CUSTOM_APP:
        return getCustomApplicationDefaultValues({ app: applicationData });
      case ApplicationSlug.QUICK_APP:
        return getQuickAppDefaultValues({ app: applicationData });
      case ApplicationSlug.CODE_APP:
        return getCodeAppDefaultValues({
          app: applicationData,
          runtime: pythonVersions[0],
        });
      default:
        return {};
    }
  };

  const getFormView = (type?: ApplicationSlug) => {
    switch (type) {
      case ApplicationSlug.CUSTOM_APP:
        return <ApplicationView />;
      case ApplicationSlug.QUICK_APP:
        return <QuickAppView />;
      case ApplicationSlug.CODE_APP:
        return <CodeAppView />;
      case ApplicationSlug.MINDMAP_APP:
        return (
          <MindmapView
            id={applicationData.name}
            currentProviderId={currentProviderId}
            mindmapHost={frontendHost ?? ''}
          />
        );
      default:
        router.push('/404');
    }
  };

  const getPreview = (
    type: ApplicationSlug,
    data: CustomApplicationFormData | QuickAppFormData,
  ) => {
    switch (type) {
      case ApplicationSlug.MINDMAP_APP:
        return (
          <MindmapPreview
            id={applicationData.name}
            currentProviderId={currentProviderId}
            mindmapHost={frontendHost ?? ''}
          />
        );
      default:
        return <GeneralInfoPreview data={getPreviewEntityData(data)} />;
    }
  };

  const methods = useForm<CustomApplicationFormData | QuickAppFormData>({
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
