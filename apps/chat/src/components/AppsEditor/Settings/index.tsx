import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarRightCollapse,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { BucketService } from '@/src/utils/app/data/bucket-service';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-chema';
import {
  ApiApplicationResponseDefault,
  ApplicationSlug,
} from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
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
  type: string;
  schema: ApiDetailedApplicationTypeSchema | null;
  applicationData: ApiApplicationResponseDefault;
  currentProviderId: string;
  frontendHost: string | null;
  previewConversationId: string | null;
}

export const ApplicationSettings: React.FC<Props> = ({
  type,
  applicationData,
  currentProviderId,
  frontendHost,
  previewConversationId,
  schema,
}) => {
  const pythonVersions = useAppSelector(
    SettingsSelectors.selectCodeEditorPythonVersions,
  );
  const { t } = useTranslation(Translation.Chat);

  const [previewMode, setPreviewMode] = useState<'half' | 'full' | 'closed'>(
    'closed',
  );

  const getDefaultValues = (type: string) => {
    const defaultValues: Record<
      string,
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
      ['QuickApps']: getQuickAppDefaultValues({
        app: applicationData,
      }),
    };

    return defaultValues[type];
  };

  const getFormView = (type: string) => {
    const formViews: Record<string, JSX.Element> = {
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
      ['QuickApps']: <QuickAppView />,
    };
    return (
      formViews[schema?.['dial:applicationTypeDisplayName'] ?? type] ?? null
    );
  };

  const getPreview = (
    type: string,
    data: CustomApplicationFormData | QuickAppFormData,
    selectedConversationsId: string,
  ) => {
    if (type === ApplicationSlug.MINDMAP_APP && selectedConversationsId) {
      return (
        <MindmapPreview
          id={applicationData.name}
          currentProviderId={currentProviderId}
          mindmapHost={frontendHost ?? ''}
          selectedConversationsId={selectedConversationsId}
        />
      );
    }
    return <GeneralInfoPreview data={getPreviewEntityData(data)} />;
  };

  const methods = useForm<CustomApplicationFormData | QuickAppFormData>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues:
      getDefaultValues(schema?.['dial:applicationTypeDisplayName'] ?? type) ??
      {},
  });

  const formData = methods.watch();

  const dispatch = useAppDispatch();

  const [selectedConversationsId] = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );

  useEffect(() => {
    if (previewConversationId) {
      return;
    }

    dispatch(
      ConversationsActions.createNewConversations({
        names: ['preview conversation'],
        modelReference: applicationData.reference,
        folderId: `conversations/${BucketService.getBucket()}`,
      }),
    );
  }, [applicationData.reference, previewConversationId, dispatch]);

  return (
    <div className="flex w-full overflow-hidden">
      <div
        className={classNames('transition-all duration-300 ease-in-out', {
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
              <button
                className="text-secondary hover:text-accent-primary"
                onClick={() => setPreviewMode('full')}
              >
                <IconArrowsMaximize size={24} />
              </button>
            )}
            {previewMode === 'full' && (
              <button
                className="text-secondary hover:text-accent-primary"
                onClick={() => setPreviewMode('half')}
              >
                <IconLayoutSidebarRightCollapse size={24} />
              </button>
            )}
            <button
              className="text-secondary hover:text-accent-primary"
              onClick={() => setPreviewMode('closed')}
            >
              <IconArrowsMinimize size={24} />
            </button>
          </div>
        </div>
        {previewMode !== 'closed' && (
          <div className="flex-1 overflow-auto">
            {getPreview(
              type,
              formData,
              previewConversationId ?? selectedConversationsId,
            )}
          </div>
        )}
      </div>

      {previewMode === 'closed' && (
        <div
          className="flex h-full w-10 flex-col items-center space-y-3 border-l border-primary pt-2 transition-all duration-300 ease-in-out hover:cursor-pointer"
          onClick={() => setPreviewMode('half')}
        >
          <button
            className="text-secondary hover:text-accent-primary"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewMode('full');
            }}
          >
            <IconArrowsMaximize size={24} />
          </button>

          <button
            className="text-secondary hover:text-accent-primary"
            onClick={() => {
              setPreviewMode('half');
            }}
          >
            <IconLayoutSidebarLeftCollapse size={24} />
          </button>

          <span style={{ writingMode: 'vertical-rl' }}>{t('Preview')}</span>
        </div>
      )}
    </div>
  );
};
