import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarRightCollapse,
} from '@tabler/icons-react';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  ApiApplicationResponseDefault,
  ApplicationSlug,
} from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

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
  CodeAppFormData,
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
  const pythonVersions = useAppSelector(
    SettingsSelectors.selectCodeEditorPythonVersions,
  );
  const { t } = useTranslation(Translation.Chat);

  const [previewMode, setPreviewMode] = useState<'half' | 'full' | 'closed'>(
    'closed',
  );

  const getDefaultValues = (type: ApplicationSlug) => {
    const defaultValues: Record<
      ApplicationSlug,
      CustomApplicationFormData | QuickAppFormData | CodeAppFormData | null
    > = {
      [ApplicationSlug.CUSTOM_APP]: getCustomApplicationDefaultValues({
        app: applicationData,
      }),
      [ApplicationSlug.QUICK_APP]: getQuickAppDefaultValues({
        app: applicationData,
      }),
      [ApplicationSlug.CODE_APP]: getCodeAppDefaultValues({
        app: applicationData,
        runtime: pythonVersions[0],
      }),
      [ApplicationSlug.MINDMAP_APP]: null,
    };

    return defaultValues[type];
  };

  const getFormView = (type: ApplicationSlug) => {
    const formViews = {
      [ApplicationSlug.CUSTOM_APP]: <ApplicationView />,
      [ApplicationSlug.QUICK_APP]: <QuickAppView />,
      [ApplicationSlug.CODE_APP]: <CodeAppView />,
      [ApplicationSlug.MINDMAP_APP]: (
        <MindmapView
          id={applicationData.name}
          currentProviderId={currentProviderId}
          mindmapHost={frontendHost ?? ''}
        />
      ),
    };
    return formViews[type];
  };

  const getPreview = (
    type: ApplicationSlug,
    data: CustomApplicationFormData | QuickAppFormData,
  ) => {
    if (type === ApplicationSlug.MINDMAP_APP) {
      return (
        <MindmapPreview
          id={applicationData.name}
          currentProviderId={currentProviderId}
          mindmapHost={frontendHost ?? ''}
        />
      );
    }
    return <GeneralInfoPreview data={getPreviewEntityData(data)} />;
  };

  const methods = useForm<CustomApplicationFormData | QuickAppFormData>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: getDefaultValues(type) ?? {},
  });

  const formData = methods.watch();

  return (
    <div className="flex w-full overflow-hidden">
      <div
        className={classNames('transition-all duration-300', {
          'w-full opacity-100': previewMode === 'closed',
          'w-1/2 opacity-100': previewMode === 'half',
          'w-0 opacity-0': previewMode === 'full',
        })}
      >
        <FormProvider {...methods}>{getFormView(type)}</FormProvider>
      </div>

      <div
        className={classNames(
          'flex h-full flex-col border-l border-primary transition-all duration-300 ease-in-out',
          {
            'w-1/2 opacity-100': previewMode === 'half',
            'w-full opacity-100': previewMode === 'full',
            'w-0 overflow-hidden opacity-0': previewMode === 'closed',
          },
        )}
      >
        <div className="flex items-center justify-between p-2">
          <span>{t('Preview')}</span>
          <div className="flex space-x-2">
            {previewMode === 'half' && (
              <button onClick={() => setPreviewMode('full')}>
                <IconArrowsMaximize size={24} />
              </button>
            )}
            {previewMode === 'full' && (
              <button onClick={() => setPreviewMode('half')}>
                <IconLayoutSidebarRightCollapse size={24} />
              </button>
            )}
            <button onClick={() => setPreviewMode('closed')}>
              <IconArrowsMinimize size={24} />
            </button>
          </div>
        </div>
        {previewMode !== 'closed' && (
          <div className="flex-1 overflow-auto">
            {getPreview(type, formData)}
          </div>
        )}
      </div>

      {previewMode === 'closed' && (
        <div className="flex h-full w-10 flex-col items-center space-y-2 border-l border-primary transition-all duration-300">
          <button onClick={() => setPreviewMode('half')}>
            <IconLayoutSidebarLeftCollapse size={24} />
          </button>

          <button onClick={() => setPreviewMode('full')}>
            <IconArrowsMaximize size={24} />
          </button>

          <button
            className="hover:text-accent-primary"
            onClick={() => setPreviewMode('half')}
            style={{ writingMode: 'vertical-rl' }}
          >
            {t('Preview')}
          </button>
        </div>
      )}
    </div>
  );
};
