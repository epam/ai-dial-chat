import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarRightCollapse,
  IconRefresh,
} from '@tabler/icons-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  isApplicationDeployed,
  isApplicationDeploymentInProgress,
} from '@/src/utils/app/application';
import { decode } from '@/src/utils/app/application-type-schema';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import {
  ApiDetailedApplicationTypeSchema,
  ApplicationTypeSchemaProperties,
} from '@/src/types/application-type-schema';
import {
  ApplicationStatus,
  ApplicationType,
  CustomApplicationModel,
} from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

import { ModelsActions } from '@/src/store/actions';
import { ApplicationActions } from '@/src/store/application/application.reducers';
import {
  CodeEditorActions,
  CodeEditorSelectors,
} from '@/src/store/codeEditor/codeEditor.reducer';
import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { ConversationsSelectors } from '@/src/store/conversations/conversations.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';
import { UIActions } from '@/src/store/ui/ui.reducers';
import { UISelectors } from '@/src/store/ui/ui.selectors';

import { DEFAULT_QUICK_APPS_SCHEMA_ID } from '@/src/constants/quick-apps';
import { Routes } from '@/src/constants/routes';

import Tooltip from '../../Common/Tooltip';
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

enum PreviewMode {
  half,
  full,
  closed,
}

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
  const { t } = useTranslation(Translation.Chat);

  const router = useRouter();

  const dispatch = useAppDispatch();

  const pythonVersions = useAppSelector(
    SettingsSelectors.selectCodeEditorPythonVersions,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
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
  const isCodeEditorDirty = useAppSelector(CodeEditorSelectors.selectIsDirty);
  const theme = useAppSelector(UISelectors.selectThemeState);

  const [previewMode, setPreviewMode] = useState<PreviewMode>(
    schema?.[ApplicationTypeSchemaProperties.applicationTypeViewerUrl]
      ? PreviewMode.closed
      : PreviewMode.half,
  );

  const isAppPublic = isEntityIdPublic(applicationData);
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
            oldApplication={applicationData}
            isShared={modelFromState?.isShared ?? false}
            applicationStatus={modelFromState?.functionStatus}
          />
        );
      default:
        if (
          schema?.[ApplicationTypeSchemaProperties.applicationTypeEditorUrl] &&
          schema[ApplicationTypeSchemaProperties.applicationTypeDisplayName]
        ) {
          return (
            <CustomApplicationEditorView
              id={applicationData.id}
              host={
                schema[ApplicationTypeSchemaProperties.applicationTypeEditorUrl]
              }
              theme={theme}
              title={
                schema[
                  ApplicationTypeSchemaProperties.applicationTypeDisplayName
                ]
              }
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

  const isFormChanged = useCallback(() => {
    return (
      Object.keys(methods.formState.dirtyFields).length > 0 || isCodeEditorDirty
    );
  }, [methods.formState.dirtyFields, isCodeEditorDirty]);

  const saveForm = useCallback(() => {
    if (isFormChanged() && methods.formState.isValid) {
      dispatch(ApplicationActions.setShouldSaveApplication(true));
      dispatch(CodeEditorActions.saveAllModifiedFiles());
      if (isAppDeployed) {
        dispatch(
          UIActions.showWarningToast(
            t('Saved changes will be applied during next deployment'),
          ),
        );
      }
      const currentValues = methods.getValues();

      methods.reset(currentValues);
    }
  }, [dispatch, isAppDeployed, isFormChanged, methods, t]);

  useEffect(() => {
    if (methods.formState.isValid) {
      dispatch(ApplicationActions.setHasUnsavedChanges(isFormChanged()));
    }
  }, [dispatch, isFormChanged, methods.formState]);

  const formViewElement = getFormView(type);

  const handleRedeploy = () => {
    dispatch(
      ApplicationActions.startUpdatingFunctionStatus({
        id: applicationData.id,
        status: ApplicationStatus.REDEPLOYING,
      }),
    );
  };

  useEffect(() => {
    const redirectHandler = (url: string) => {
      const pathname = new URL(url, window.location.origin).pathname;
      const targetRoute = Routes.AppsEditorGeneralInfo.replace('[slug]', type);

      if (decode(pathname ?? '') === targetRoute) saveForm();
    };

    router.events.on('routeChangeStart', redirectHandler);

    return () => router.events.off('routeChangeStart', redirectHandler);
  }, [saveForm, router.events, type]);

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

  const showRedeployButton =
    type === ApplicationType.CODE_APP && isAppDeployed && !isAppPublic;

  return (
    <div className="flex w-full flex-nowrap overflow-hidden">
      <div
        onMouseLeave={() => {
          if (!isAppPublic) {
            saveForm();
          }
        }}
        className={classNames('transition-all duration-300 ease-in-out', {
          'w-[calc(100%-40px)] opacity-100': previewMode === PreviewMode.closed,
          'w-1/2 opacity-100': previewMode === PreviewMode.half,
          'w-0 opacity-0': previewMode === PreviewMode.full,
        })}
      >
        <FormProvider {...methods}>{formViewElement}</FormProvider>
      </div>
      <div
        className={classNames(
          'flex h-full flex-col border-l border-primary transition-all duration-300 ease-in-out',
          {
            'w-1/2 opacity-100': previewMode === PreviewMode.half,
            'w-full opacity-100': previewMode === PreviewMode.full,
            'w-0 overflow-hidden opacity-0': previewMode === PreviewMode.closed,
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
            {showRedeployButton && (
              <button
                className="button button-accent-secondary mb-2 flex items-center gap-2 text-accent-secondary md:mx-4 md:mb-0 md:last:mb-6 lg:mx-auto lg:max-w-3xl"
                data-qa="redeploy-code-app"
                disabled={!methods.formState.isValid}
                onClick={handleRedeploy}
              >
                <IconRefresh size={18} />
                <span>{t('Redeploy')}</span>
              </button>
            )}
            {previewMode === PreviewMode.half && (
              <button
                className="text-secondary hover:text-accent-primary"
                onClick={() => setPreviewMode(PreviewMode.full)}
              >
                <Tooltip tooltip={t('Expand preview')}>
                  <IconArrowsMaximize size={24} />
                </Tooltip>
              </button>
            )}
            {previewMode === PreviewMode.full && (
              <button
                className="text-secondary hover:text-accent-primary"
                onClick={() => setPreviewMode(PreviewMode.half)}
              >
                <Tooltip tooltip={t('Split view')}>
                  <IconLayoutSidebarRightCollapse size={24} />
                </Tooltip>
              </button>
            )}
            <button
              className="text-secondary hover:text-accent-primary"
              onClick={() => setPreviewMode(PreviewMode.closed)}
            >
              <Tooltip tooltip={t('Hide preview')}>
                <IconArrowsMinimize size={24} />
              </Tooltip>
            </button>
          </div>
        </div>
        {previewMode !== PreviewMode.closed && (
          <div className="flex-1 overflow-auto">
            <ApplicationPreviewChat
              isAppDeploymentInProgress={isAppDeploymentInProgress}
              isApplicationValid={methods.formState.isValid}
              applicationId={applicationData.id}
              type={type}
              isAppDeployed={isAppDeployed}
            />
          </div>
        )}
      </div>
      {previewMode === PreviewMode.closed && (
        <div
          className="flex h-full w-10 flex-col items-center space-y-3 border-l border-primary pt-2 transition-all duration-300 ease-in-out hover:cursor-pointer"
          onClick={() => setPreviewMode(PreviewMode.half)}
        >
          <button
            className="text-secondary hover:text-accent-primary"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewMode(PreviewMode.full);
            }}
          >
            <Tooltip tooltip={t('Expand preview')}>
              <IconArrowsMaximize size={24} />
            </Tooltip>
          </button>

          <button
            className="text-secondary hover:text-accent-primary"
            onClick={() => setPreviewMode(PreviewMode.half)}
          >
            <Tooltip tooltip={t('Split view')}>
              <IconLayoutSidebarLeftCollapse size={24} />
            </Tooltip>
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
