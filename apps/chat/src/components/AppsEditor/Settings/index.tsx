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

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { CodeEditorActions } from '@/src/store/codeEditor/codeEditor.reducer';
import { CodeEditorSelectors } from '@/src/store/codeEditor/codeEditor.selectors';
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
import { Routes } from '@/src/constants/routes';

import { OptionsDialog } from '../../Common/OptionsDialog';
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

import debounce from 'lodash-es/debounce';

enum PreviewMode {
  half,
  full,
  closed,
}

interface Props {
  schema: ApiDetailedApplicationTypeSchema | null;
  applicationData: CustomApplicationModel;
  type: string;
  isExiting?: boolean;
  onExit?: () => void;
}

export const ApplicationSettings: React.FC<Props> = ({
  applicationData,
  schema,
  type,
  isExiting,
  onExit,
}) => {
  const router = useRouter();
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
  const isCodeEditorDirty = useAppSelector(CodeEditorSelectors.selectIsDirty);

  const theme = useAppSelector(UISelectors.selectThemeState);
  const { t } = useTranslation(Translation.Chat);

  const [previewMode, setPreviewMode] = useState<PreviewMode>(
    schema?.[ApplicationTypeSchemaProperties.applicationTypeViewerUrl]
      ? PreviewMode.closed
      : PreviewMode.half,
  );

  const [isSaveBeforeConfirmationOpen, setIsSaveBeforeConfirmationOpen] =
    useState(false);

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
            onExit={onExit}
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

  const startRedeploy = useCallback(() => {
    dispatch(
      ApplicationActions.startUpdatingFunctionStatus({
        id: applicationData.id,
        status: ApplicationStatus.REDEPLOYING,
      }),
    );
  }, [applicationData.id, dispatch]);

  const handleRedeploy = () => {
    if (isCodeEditorDirty) {
      setIsSaveBeforeConfirmationOpen(true);
      return;
    }
    startRedeploy();
  };

  const modalOptions = useMemo(
    () => [
      {
        label: t("Don't save"),
        dataQa: 'not-save-option',
        className: 'button-secondary',
        onClick: () => {
          startRedeploy();
          setIsSaveBeforeConfirmationOpen(false);
        },
      },
      {
        label: t('Save'),
        dataQa: 'save-option',
        onClick: () => {
          dispatch(CodeEditorActions.saveAllModifiedFiles());
          startRedeploy();
          setIsSaveBeforeConfirmationOpen(false);
        },
      },
    ],
    [t, startRedeploy, dispatch],
  );

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

  return (
    <div className="flex w-full flex-nowrap overflow-hidden">
      <div
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
            {type === ApplicationType.CODE_APP && isAppDeployed && (
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
              onPreviewMouseEnter={handlePreviewMouseEnter}
              onPreviewMouseLeave={handlePreviewMouseLeave}
              isAppDeploymentInProgress={isAppDeploymentInProgress}
              isApplicationValid={methods.formState.isValid}
              applicationId={applicationData.id}
              type={type}
              isAppDeployed={isAppDeployed}
              isExiting={isExiting}
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
      <OptionsDialog
        isOpen={!!isSaveBeforeConfirmationOpen}
        heading={t(
          'Do you want to save changes in the code editor before redeploy?',
        )}
        options={modalOptions}
      />
    </div>
  );
};
