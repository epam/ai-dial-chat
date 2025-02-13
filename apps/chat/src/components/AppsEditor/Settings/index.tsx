import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarRightCollapse,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import {
  ApplicationStatus,
  ApplicationType,
  CustomApplicationModel,
} from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { Chat } from '../../Chat/Chat';
import { ApplicationView } from './ApplicationView';
import { CodeAppView } from './CodeAppView';
import { CustomApplicationEditorView } from './CustomApplicationEditorView';
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
  schema: ApiDetailedApplicationTypeSchema | null;
  applicationData: CustomApplicationModel;
  type: string;
}

export const ApplicationSettings: React.FC<Props> = ({
  applicationData,
  schema,
  type,
}) => {
  const pythonVersions = useAppSelector(
    SettingsSelectors.selectCodeEditorPythonVersions,
  );

  const isAppDeployed =
    applicationData?.function?.status === ApplicationStatus.DEPLOYED;

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const modelFromState = applicationData
    ? modelsMap[applicationData.reference]
    : null;

  const previewConversationId = useAppSelector(
    ConversationsSelectors.selectPreviewConversationId,
  );

  const isConversationInitialized = useAppSelector(
    ConversationsSelectors.selectInitialized,
  );

  const areSelectedConversationLoaded = useAppSelector(
    ConversationsSelectors.areConversationsUploaded,
  );
  const areSelectedConversationsLoaded = useAppSelector(
    ConversationsSelectors.selectAreSelectedConversationsLoaded,
  );
  const theme = useAppSelector(UISelectors.selectThemeState);
  const { t } = useTranslation(Translation.Chat);

  const [previewMode, setPreviewMode] = useState<'half' | 'full' | 'closed'>(
    schema?.['dial:applicationTypeViewerUrl'] ? 'closed' : 'half',
  );

  const getDefaultValues = (type: string) => {
    const defaultValues: Record<
      string,
      CustomApplicationFormData | QuickAppFormData | CodeAppFormData | null
    > = {
      [ApplicationType.CUSTOM_APP]: getCustomApplicationDefaultValues({
        app: applicationData,
      }),
      [ApplicationType.CODE_APP]: getCodeAppDefaultValues({
        app: applicationData,
        runtime: pythonVersions[0],
      }),
      ['Quick App']: getQuickAppDefaultValues({
        app: applicationData,
      }),
    };

    return defaultValues[type] ?? null;
  };

  const getFormView = (type: string) => {
    // will be removed after all apps are migrated to the new schema flow
    const formViews: Record<string, JSX.Element> = {
      [ApplicationType.CUSTOM_APP]: (
        <ApplicationView oldApplication={applicationData} />
      ),
      [ApplicationType.CODE_APP]: (
        <CodeAppView
          isSharedWithMe={modelFromState?.sharedWithMe ?? false}
          isAppDeployed={isAppDeployed}
          oldApplication={applicationData}
          isShared={modelFromState?.isShared ?? false}
        />
      ),
      ['Quick App']: (
        <QuickAppView
          schema={schema}
          isSharedWithMe={modelFromState?.sharedWithMe ?? false}
          oldApplication={applicationData}
        />
      ),
    };

    const customView =
      formViews[schema?.['dial:applicationTypeDisplayName'] ?? type];

    if (
      !customView &&
      schema?.['dial:applicationTypeEditorUrl'] &&
      schema['dial:applicationTypeDisplayName']
    ) {
      return (
        <CustomApplicationEditorView
          id={applicationData.name}
          host={schema['dial:applicationTypeEditorUrl']}
          theme={theme}
          title={schema['dial:applicationTypeDisplayName']}
        />
      );
    }

    return customView ?? null;
  };

  const getPreview = () => {
    if (
      !areSelectedConversationsLoaded ||
      !isConversationInitialized ||
      !areSelectedConversationLoaded
    )
      return null;
    return (
      <div className="flex size-full min-w-0 grow flex-col">
        <Chat />
      </div>
    );
  };

  const methods = useForm<CustomApplicationFormData | QuickAppFormData>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues:
      getDefaultValues(schema?.['dial:applicationTypeDisplayName'] ?? type) ??
      {},
  });

  const dispatch = useAppDispatch();

  useEffect(() => {
    if (
      !areSelectedConversationsLoaded ||
      !isConversationInitialized ||
      !areSelectedConversationLoaded
    ) {
      return;
    }
    dispatch(
      ModelsActions.updateRecentModels({
        modelId: applicationData.reference,
      }),
    );

    if (previewConversationId) {
      dispatch(
        ConversationsActions.selectConversations({
          conversationIds: [previewConversationId],
        }),
      );
    } else {
      dispatch(
        ConversationsActions.createNewConversations({
          names: ['Preview Conversation'],
          modelReference: applicationData.reference,
        }),
      );
    }
  }, [
    previewConversationId,
    applicationData.reference,
    isConversationInitialized,
    dispatch,
    areSelectedConversationsLoaded,
    areSelectedConversationLoaded,
  ]);

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
          <div className="flex-1 overflow-auto">{getPreview()}</div>
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

          <span className="select-none" style={{ writingMode: 'vertical-rl' }}>
            {t('Preview')}
          </span>
        </div>
      )}
    </div>
  );
};
