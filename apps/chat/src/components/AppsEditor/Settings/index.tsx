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

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  isApplicationDeployed,
  isApplicationDeploymentInProgress,
} from '@/src/utils/app/application';
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
import { ScreenState } from '@/src/types/common';
import { PreviewMode } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  CodeEditorActions,
  ConversationsActions,
  ModelsActions,
  UIActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  CodeEditorSelectors,
  ConversationsSelectors,
  ModelsSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { DEFAULT_QUICK_APPS_SCHEMA_ID } from '@/src/constants/quick-apps';
import { Routes } from '@/src/constants/routes';

import { TabButton } from '@/src/components/Buttons/TabButton';
import { Tooltip } from '@/src/components/Common/Tooltip';

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

  const screenState = useScreenState();

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
    screenState <= ScreenState.MD ||
      schema?.[ApplicationTypeSchemaProperties.applicationTypeViewerUrl]
      ? PreviewMode.closed
      : PreviewMode.half,
  );

  const isPreviewClosed = previewMode === PreviewMode.closed;
  const isPreviewHalf = previewMode === PreviewMode.half;
  const isPreviewFull = previewMode === PreviewMode.full;

  const handlePreviewModeChange = (mode: PreviewMode) => {
    setPreviewMode(mode);
  };

  const handleOpenPreview = () => {
    if (screenState > ScreenState.MD) {
      handlePreviewModeChange(PreviewMode.half);
    } else {
      handlePreviewModeChange(PreviewMode.full);
    }
  };

  const handleFullModeClick = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => {
    e.stopPropagation();
    handlePreviewModeChange(PreviewMode.full);
  };

  useEffect(() => {
    if (screenState <= ScreenState.MD && isPreviewHalf) {
      handlePreviewModeChange(PreviewMode.closed);
    }
  }, [isPreviewHalf, previewMode, screenState]);

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

      if (decodeURIComponent(pathname ?? '') === targetRoute) saveForm();
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
    <div className="flex size-full flex-col">
      <div className="flex w-full justify-center gap-2 border-b border-primary px-3 py-2 text-primary md:hidden">
        <TabButton
          selected={!isPreviewFull}
          onClick={() => handlePreviewModeChange(PreviewMode.closed)}
          className="w-full"
        >
          {t('Settings')}
        </TabButton>
        <TabButton
          selected={isPreviewFull}
          onClick={() => handlePreviewModeChange(PreviewMode.full)}
          className="w-full"
        >
          {t('Preview')}
        </TabButton>
      </div>

      <div className="flex w-full grow overflow-hidden">
        <div
          onMouseLeave={() => {
            if (!isAppPublic) {
              saveForm();
            }
          }}
          className={classNames('transition-all duration-300 ease-in-out', {
            'w-[calc(100%-40px)] opacity-100 max-md:w-full': isPreviewClosed,
            'w-1/2 opacity-100': isPreviewHalf,
            'w-0 opacity-0': isPreviewFull,
          })}
        >
          <FormProvider {...methods}>{formViewElement}</FormProvider>
        </div>
        <div
          className={classNames(
            'flex h-full flex-col border-l border-primary transition-all duration-300 ease-in-out',
            {
              'w-1/2 opacity-100': isPreviewHalf,
              'w-full opacity-100': isPreviewFull,
              'w-0 overflow-hidden opacity-0': isPreviewClosed,
            },
          )}
          data-qa="app-preview-settings"
        >
          <div className="flex max-w-full items-center justify-between px-0 py-3 max-md:self-end md:px-5 md:py-4 xl:px-5 xl:py-4">
            <div className="mr-2 hidden min-w-0 shrink grow gap-2 text-primary md:flex">
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
                  className="xl:button button-accent-secondary mb-0 flex items-center gap-2 border-r border-secondary px-3 py-0 text-accent-secondary md:last:mb-6 lg:max-w-3xl xl:mx-auto xl:border-none"
                  data-qa="redeploy-code-app"
                  disabled={!methods.formState.isValid}
                  onClick={handleRedeploy}
                >
                  <IconRefresh size={18} />
                  <span>{t('Redeploy')}</span>
                </button>
              )}
              {isPreviewHalf && (
                <button
                  className="text-secondary hover:text-accent-primary max-xl:hidden"
                  onClick={() => handlePreviewModeChange(PreviewMode.full)}
                >
                  <Tooltip tooltip={t('Expand preview')}>
                    <IconArrowsMaximize size={24} />
                  </Tooltip>
                </button>
              )}
              {isPreviewFull && (
                <button
                  className="text-secondary hover:text-accent-primary max-xl:hidden"
                  onClick={() => handlePreviewModeChange(PreviewMode.half)}
                >
                  <Tooltip tooltip={t('Split view')}>
                    <IconLayoutSidebarRightCollapse size={24} />
                  </Tooltip>
                </button>
              )}
              <button
                className="ml-4 hidden text-secondary hover:text-accent-primary md:flex xl:ml-2"
                onClick={() => handlePreviewModeChange(PreviewMode.closed)}
              >
                <Tooltip tooltip={t('Hide preview')}>
                  <IconArrowsMinimize size={24} />
                </Tooltip>
              </button>
            </div>
          </div>
          {!isPreviewClosed && (
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
        {isPreviewClosed && (
          <div
            className="flex h-full w-10 flex-col items-center space-y-3 border-l border-primary pt-4 transition-all duration-300 ease-in-out hover:cursor-pointer max-md:hidden xl:pt-4"
            onClick={handleOpenPreview}
          >
            <button
              className="text-secondary hover:text-accent-primary"
              onClick={handleFullModeClick}
            >
              <Tooltip tooltip={t('Expand preview')}>
                <IconArrowsMaximize size={24} />
              </Tooltip>
            </button>

            <button
              className="text-secondary hover:text-accent-primary max-xl:hidden"
              onClick={() => handlePreviewModeChange(PreviewMode.half)}
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
    </div>
  );
};
