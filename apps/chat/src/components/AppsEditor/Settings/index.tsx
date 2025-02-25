import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarRightCollapse,
  IconRefresh,
} from '@tabler/icons-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  isApplicationDeployed,
  isApplicationDeploymentInProgress,
} from '@/src/utils/app/application';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import {
  ApplicationStatus,
  ApplicationType,
  CustomApplicationModel,
} from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
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

import { DEFAULT_QUICK_APPS_SCHEMA_ID } from '@/src/constants/quick-apps';

import { ApplicationView } from './ApplicationView';
import { CodeAppView } from './CodeAppView';
import { CustomApplicationEditorView } from './CustomApplicationEditorView';
import { ApplicationPreviewChat } from './Previews/ApplicationPreviewChat';
import { QuickAppView } from './QuickAppView';
import {
  CodeAppFormData,
  CustomApplicationFormData,
  QuickAppFormData,
  getCodeAppDefaultValues,
  getCustomApplicationDefaultValues,
  getQuickAppDefaultValues,
} from './form';

import { debounce } from 'lodash-es';

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
  const dispatch = useAppDispatch();
  const pythonVersions = useAppSelector(
    SettingsSelectors.selectCodeEditorPythonVersions,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const modelFromState = applicationData
    ? modelsMap[applicationData.reference]
    : null;
  const isAppDeployed = useMemo(
    () => !!modelFromState && isApplicationDeployed(modelFromState),
    [modelFromState],
  );
  const isAppDeploymentInProgress = useMemo(
    () => !!modelFromState && isApplicationDeploymentInProgress(modelFromState),
    [modelFromState],
  );

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

  const getDefaultValues = useCallback(
    (type: string) => {
      if (DEFAULT_QUICK_APPS_SCHEMA_ID.endsWith(type)) {
        return getQuickAppDefaultValues({
          app: applicationData,
        });
      }

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
      };
      return defaultValues[type] ?? null;
    },
    [applicationData, pythonVersions],
  );

  const getFormView = (type: string) => {
    if (DEFAULT_QUICK_APPS_SCHEMA_ID.endsWith(type)) {
      return (
        <QuickAppView
          schema={schema}
          isSharedWithMe={modelFromState?.sharedWithMe ?? false}
          oldApplication={applicationData}
          isShared={modelFromState?.isShared ?? false}
        />
      );
    }

    switch (type) {
      case ApplicationType.CUSTOM_APP:
        return <ApplicationView oldApplication={applicationData} />;
      case ApplicationType.CODE_APP:
        return (
          <CodeAppView
            isSharedWithMe={modelFromState?.sharedWithMe ?? false}
            isAppDeployed={isAppDeployed}
            oldApplication={applicationData}
            isShared={modelFromState?.isShared ?? false}
            applicationStatus={modelFromState?.functionStatus}
          />
        );
      default:
        if (
          schema?.['dial:applicationTypeEditorUrl'] &&
          schema['dial:applicationTypeDisplayName']
        ) {
          return (
            <CustomApplicationEditorView
              id={applicationData.id}
              host={schema['dial:applicationTypeEditorUrl']}
              theme={theme}
              title={schema['dial:applicationTypeDisplayName']}
            />
          );
        }
        return null;
    }
  };

  const methods = useForm<
    CustomApplicationFormData | QuickAppFormData | CodeAppFormData
  >({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: getDefaultValues(type) ?? {},
  });

  const saveForm = useCallback(() => {
    methods.formState.isValid &&
      dispatch(ApplicationActions.setShouldSaveApplication(true));
  }, [dispatch, methods.formState.isValid]);

  const debouncedSave = useMemo(() => debounce(saveForm, 750), [saveForm]);

  const handlePreviewMouseEnter = useCallback(() => {
    debouncedSave();
  }, [debouncedSave]);
  const handlePreviewMouseLeave = useCallback(() => {
    debouncedSave.cancel();
  }, [debouncedSave]);

  const formViewElement = getFormView(type);

  useEffect(() => {
    if (
      !areSelectedConversationLoaded ||
      !isConversationInitialized ||
      !areSelectedConversationsLoaded
    )
      return;
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
        <FormProvider {...methods}>{formViewElement}</FormProvider>
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
        <div className="flex max-w-full items-center justify-between p-2">
          <div className="mr-2 flex min-w-0 shrink grow gap-2 text-primary">
            <span>{t('Preview')}:</span>
            <span
              data-qa="preview-app-version"
              className="min-w-0 shrink truncate"
            >
              {applicationData.name}
            </span>
            <span data-qa="preview-app-version" className="text-nowrap">
              {t('v.')} {applicationData.version}
            </span>
          </div>
          <div className="flex space-x-2">
            {type === ApplicationType.CODE_APP && isAppDeployed && (
              <button
                className="button button-accent-secondary mb-2 flex items-center gap-2 text-accent-secondary md:mx-4 md:mb-0 md:last:mb-6 lg:mx-auto lg:max-w-3xl"
                data-qa="redeploy-code-app"
                disabled={!methods.formState.isValid}
                onClick={() => {
                  dispatch(
                    ApplicationActions.startUpdatingFunctionStatus({
                      id: applicationData.id,
                      status: ApplicationStatus.REDEPLOYING,
                    }),
                  );
                }}
              >
                <IconRefresh size={12} />
                <span>{t('Redeploy')}</span>
              </button>
            )}
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
            <ApplicationPreviewChat
              handlePreviewMouseEnter={handlePreviewMouseEnter}
              handlePreviewMouseLeave={handlePreviewMouseLeave}
              isAppDeploymentInProgress={isAppDeploymentInProgress}
              isApplicationValid={methods.formState.isValid}
              applicationId={applicationData.id}
              type={type}
              isAppDeployed={isAppDeployed}
            />
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
            onClick={() => setPreviewMode('half')}
          >
            <IconLayoutSidebarLeftCollapse size={24} />
          </button>
          <span
            className="select-none text-primary"
            style={{ writingMode: 'vertical-rl' }}
          >
            {t('Preview')}: {applicationData.name} {t('v.')}{' '}
            {applicationData.version}
          </span>
        </div>
      )}
    </div>
  );
};
