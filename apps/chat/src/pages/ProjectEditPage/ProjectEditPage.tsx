import {
  useAttachmentCanvas,
  useLatestCanvasRequest,
  useOpenAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import {
  ProjectCreateErrorCode,
  TextRefinementPurpose,
} from '@epam/ai-dial-chat-api-client';
import {
  getMimeTypesForExtensions,
  ProjectDraftMode,
  useProject,
  useProjectDraft,
  useProjectFilePreview,
  useSaveProject,
} from '@epam/ai-dial-chat-hooks/project';
import { generateUUID, MIME_TYPE_EXT_MAP } from '@epam/ai-dial-chat-shared';
import {
  ProjectCreateForm,
  type ProjectContextFile,
  type ProjectCreateFormLabels,
  ProjectView,
} from '@epam/ai-dial-projects';
import { EditorThemes, GhostButton } from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useEffect, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import ProjectFileManagerModal from '../../components/ProjectFileManagerModal/ProjectFileManagerModal';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import {
  getProjectViewRoute,
  parseProjectRouteParams,
} from '../../constants/routes';
import {
  ButtonsI18nKeys,
  ProjectsI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { useUser } from '../../context/auth/UserContext';
import { useNotification } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { useUserConfig } from '../../context/UserConfigContext';
import { useAttachmentCanvasResolvers } from '../../hooks/attachment/useAttachmentCanvasResolvers';
import { projectsClient } from '../../hooks/projects/projects-client';
import { useProjectCreateFormLabels } from '../../hooks/projects/useProjectCreateFormLabels';
import { useProjectFileManagerPicker } from '../../hooks/projects/useProjectFileManagerPicker';
import { useProjectViewLabels } from '../../hooks/projects/useProjectViewLabels';
import { useBuilderLeaveGuard } from '../../hooks/unsaved-changes/useBuilderLeaveGuard';
import { useTextRefinementCallback } from '../../hooks/useTextRefinementCallback';
import { ROUTES } from '../../types/routes';
import { ThemeId } from '../../types/theme-id';
import { UserConfigStatus } from '../../types/user-config-status';
import { resolveProjectFileDownloadUrl } from '../../utils/dial-file';
import { mapProjectCreateError } from '../../utils/project-create-errors';
import { toProjectContextFileAttachment } from '../../utils/project-file-preview';
import NotFoundPage from '../NotFound/NotFound';

const ProjectEditPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const { config, status: appConfigStatus } = useAppConfig();
  const isEnabled = useFeatureFlag('projectsEnabled');
  const { user } = useUser();
  const { currentTheme } = useTheme();
  const {
    showSuccessNotification,
    showErrorNotification,
    dismissNotification,
  } = useNotification();
  const { replacePinnedProjectId } = useUserConfig();
  const onRefineInstructions = useTextRefinementCallback(
    TextRefinementPurpose.ProjectInstructions,
  );

  const projectId = parseProjectRouteParams(params);
  const { project, isLoading, hasError, isNotFound, retry } = useProject(
    projectsClient,
    projectId,
    isEnabled,
  );
  const viewLabels = useProjectViewLabels();

  const {
    projectContextAllowedExtensions: allowedExtensions,
    projectContextFileMaxBytes: maxFileBytes,
    projectContextTotalMaxBytes: maxTotalBytes,
  } = config;

  const {
    values,
    contextFiles,
    errors,
    setErrors,
    onFieldChange: handleFieldChange,
    onContextFilesChange,
    isSeeded,
    isDirty,
    removedFileNames,
    newFiles,
  } = useProjectDraft({ mode: ProjectDraftMode.Edit, project });
  const { allowNextNavigation } = useBuilderLeaveGuard({ isDirty });

  /* Opens a context file in the canvas the way the conversation opens an attachment. */
  const { attachmentId, closeCanvas } = useAttachmentCanvas();
  const { resolvers, options } = useAttachmentCanvasResolvers();
  const { openAttachmentCanvas } = useOpenAttachmentCanvas(resolvers, options);
  const startCanvasRequest = useLatestCanvasRequest();
  const resolveContextAttachment = useCallback(
    (id: string) => {
      const file = contextFiles.find((item) => item.id === id);
      return file && toProjectContextFileAttachment(file, projectId);
    },
    [contextFiles, projectId],
  );
  const {
    selectedContextFileId,
    onContextFileClick: handleContextFileClick,
    onContextFileDownload: handleContextFileDownload,
    closeIfRemoved,
  } = useProjectFilePreview({
    scope: projectId ?? '',
    attachmentId,
    openAttachment: openAttachmentCanvas,
    closeCanvas,
    startRequest: startCanvasRequest,
    resolveContextAttachment,
    resolveDownloadUrl: resolveProjectFileDownloadUrl,
  });

  const { save, isSubmitting } = useSaveProject(projectsClient);
  const picker = useProjectFileManagerPicker(user?.bucket);
  const createLabels = useProjectCreateFormLabels({
    allowedExtensions,
    maxFileBytes,
  });
  const labels = useMemo<ProjectCreateFormLabels>(
    () => ({
      ...createLabels,
      title: t(ProjectsI18nKeys.EditTitle),
      createLabel: t(ButtonsI18nKeys.Save),
      submittingLabel: t(ProjectsI18nKeys.EditSaving),
      creatingStatus: t(ProjectsI18nKeys.EditSavingStatus),
      nameReadOnlyHint: t(ProjectsI18nKeys.EditNameReadOnlyHint),
    }),
    [createLabels, t],
  );
  const allowedMimeTypes = useMemo(
    () => getMimeTypesForExtensions(allowedExtensions, MIME_TYPE_EXT_MAP),
    [allowedExtensions],
  );
  const markdownEditorTheme: EditorThemes =
    currentTheme === ThemeId.Dark ? EditorThemes.dark : EditorThemes.light;

  /* A project the caller cannot edit is shown, not edited. */
  useEffect(() => {
    if (project != null && !project.canEdit && projectId != null) {
      navigate(getProjectViewRoute(projectId), { replace: true });
    }
  }, [project, projectId, navigate]);

  const handleContextFilesChange = useCallback(
    (files: ProjectContextFile[]) => {
      onContextFilesChange(files);
      closeIfRemoved(files);
    },
    [closeIfRemoved, onContextFilesChange],
  );

  const handleLeave = useCallback(() => {
    navigate(projectId ? getProjectViewRoute(projectId) : ROUTES.Projects);
  }, [navigate, projectId]);

  const showChangedElsewhere = useCallback(
    (requestId?: string) => {
      const toastId = generateUUID();
      const handleReload = () => {
        dismissNotification(toastId);
        retry();
      };
      showErrorNotification({
        id: toastId,
        message: t(ProjectsI18nKeys.ErrorsChangedElsewhere),
        requestId,
        action: (
          <GhostButton
            label={t(ButtonsI18nKeys.Reload)}
            onClick={handleReload}
          />
        ),
      });
    },
    [dismissNotification, retry, showErrorNotification, t],
  );

  const handleSubmit = useCallback(async () => {
    if (project == null) return;
    const name = project.name;
    const outcome = await save({
      id: project.id,
      fields: { ...values, name },
      newFiles,
      removedFileNames,
      contentVersion: project.contentVersion,
    });

    if (outcome.isSaved) {
      showSuccessNotification({
        message: t(ProjectsI18nKeys.EditToastSuccess, { name }),
      });
      if (outcome.project.id !== project.id) {
        /* The BFF moves the pin best-effort, so follow what it reports. */
        replacePinnedProjectId(
          project.id,
          outcome.project.isPinned ? outcome.project.id : null,
        );
      }
      allowNextNavigation();
      /* Replace the edit entry, so Back never lands on a stale edit URL. */
      navigate(getProjectViewRoute(outcome.project.id), { replace: true });
      return;
    }
    if (outcome.isAborted) return;

    if (outcome.code === ProjectCreateErrorCode.ProjectChanged) {
      showChangedElsewhere(outcome.requestId);
      return;
    }
    if (outcome.code === ProjectCreateErrorCode.ProjectTooLarge) {
      showErrorNotification({
        message: t(ProjectsI18nKeys.EditToastTooLarge),
        requestId: outcome.requestId,
      });
      return;
    }
    const fieldError = mapProjectCreateError(outcome.code);
    if (fieldError) {
      setErrors((prev) => ({ ...prev, [fieldError.field]: t(fieldError.key) }));
      return;
    }
    showErrorNotification({
      message: t(ProjectsI18nKeys.EditToastError),
      requestId: outcome.requestId,
    });
  }, [
    project,
    values,
    newFiles,
    removedFileNames,
    setErrors,
    save,
    showSuccessNotification,
    showErrorNotification,
    showChangedElsewhere,
    replacePinnedProjectId,
    allowNextNavigation,
    navigate,
    t,
  ]);

  const handleFormSubmit = useCallback(() => {
    void handleSubmit();
  }, [handleSubmit]);

  const handleBrowseProjects = useCallback(
    () => navigate(ROUTES.Projects),
    [navigate],
  );
  const noop = useCallback(() => undefined, []);

  if (appConfigStatus !== UserConfigStatus.Ready) {
    return <RouteFallback />;
  }

  if (!isEnabled) {
    return <NotFoundPage />;
  }

  /* A read-only project is being redirected to its view page. */
  if (isLoading || (project != null && (!isSeeded || !project.canEdit))) {
    return <RouteFallback />;
  }

  /* Error and not-found reuse the view's own states; nothing editable shows. */
  if (project == null) {
    return (
      <ProjectView
        project={null}
        hasError={hasError}
        isNotFound={isNotFound || projectId == null}
        isPinned={false}
        contextSearchQuery=""
        onContextSearchQueryChange={noop}
        onBack={handleBrowseProjects}
        onTogglePin={noop}
        onDownload={noop}
        onContextFileClick={noop}
        onRetry={retry}
        onBrowseProjects={handleBrowseProjects}
        labels={viewLabels}
      />
    );
  }

  return (
    <>
      <ProjectCreateForm
        values={values}
        errors={errors}
        onFieldChange={handleFieldChange}
        contextFiles={contextFiles}
        onContextFilesChange={handleContextFilesChange}
        onContextFileClick={handleContextFileClick}
        onContextFileDownload={handleContextFileDownload}
        selectedContextFileId={selectedContextFileId}
        allowedExtensions={allowedExtensions}
        maxFileBytes={maxFileBytes}
        maxTotalBytes={maxTotalBytes}
        onPickFromFileManager={
          user?.bucket ? picker.pickFromFileManager : undefined
        }
        onRefineInstructions={onRefineInstructions}
        onBack={handleLeave}
        onCancel={handleLeave}
        onSubmit={handleFormSubmit}
        isSubmitting={isSubmitting}
        isNameReadOnly
        labels={labels}
        markdownEditorTheme={markdownEditorTheme}
      />
      {user?.bucket && (
        <ProjectFileManagerModal
          isOpen={picker.isOpen}
          bucket={user.bucket}
          allowedTypes={allowedMimeTypes}
          maxSelectableFileSize={maxFileBytes}
          onAttach={picker.handleAttach}
          onClose={picker.handleClose}
        />
      )}
    </>
  );
};

export default memo(ProjectEditPage);
