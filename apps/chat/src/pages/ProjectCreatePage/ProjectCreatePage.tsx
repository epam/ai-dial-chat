import {
  useAttachmentCanvas,
  useLatestCanvasRequest,
  useOpenAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import { TextRefinementPurpose } from '@epam/ai-dial-chat-api-client';
import {
  getMimeTypesForExtensions,
  ProjectDraftMode,
  useCreateProject,
  useProjectDraft,
  useProjectFilePreview,
} from '@epam/ai-dial-chat-hooks/project';
import { MIME_TYPE_EXT_MAP } from '@epam/ai-dial-chat-shared';
import {
  ProjectCreateForm,
  type ProjectContextFile,
} from '@epam/ai-dial-projects';
import { EditorThemes } from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import ProjectFileManagerModal from '../../components/ProjectFileManagerModal/ProjectFileManagerModal';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import { getProjectViewRoute } from '../../constants/routes';
import { ProjectsI18nKeys } from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { useUser } from '../../context/auth/UserContext';
import { useNotification } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { useAttachmentCanvasResolvers } from '../../hooks/attachment/useAttachmentCanvasResolvers';
import { projectsClient } from '../../hooks/projects/projects-client';
import { useProjectCreateFormLabels } from '../../hooks/projects/useProjectCreateFormLabels';
import { useProjectFileManagerPicker } from '../../hooks/projects/useProjectFileManagerPicker';
import { useBuilderLeaveGuard } from '../../hooks/unsaved-changes/useBuilderLeaveGuard';
import { useTextRefinementCallback } from '../../hooks/useTextRefinementCallback';
import { ROUTES } from '../../types/routes';
import { ThemeId } from '../../types/theme-id';
import { UserConfigStatus } from '../../types/user-config-status';
import { mapProjectCreateError } from '../../utils/project-create-errors';
import { toProjectContextFileAttachment } from '../../utils/project-file-preview';
import NotFoundPage from '../NotFound/NotFound';

/* Canvas key scope: the project has no id until it is created. */
const PREVIEW_SCOPE = 'new';

const ProjectCreatePage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { config, status: appConfigStatus } = useAppConfig();
  const isEnabled = useFeatureFlag('projectsEnabled');
  const { user } = useUser();
  const { currentTheme } = useTheme();
  const { showSuccessNotification, showErrorNotification } = useNotification();
  const onRefineInstructions = useTextRefinementCallback(
    TextRefinementPurpose.ProjectInstructions,
  );

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
    isDirty,
    newFiles,
  } = useProjectDraft({ mode: ProjectDraftMode.Create });

  /* The page owns the unsaved-changes guard, as `ScheduledTaskCreatePage`
   * does: in-app navigation asks for confirmation and `beforeunload` is armed
   * while anything was entered. */
  const { allowNextNavigation } = useBuilderLeaveGuard({ isDirty });

  /* Opens a context file in the canvas the way the conversation opens an attachment. */
  const { attachmentId, closeCanvas } = useAttachmentCanvas();
  const { resolvers, options } = useAttachmentCanvasResolvers();
  const { openAttachmentCanvas } = useOpenAttachmentCanvas(resolvers, options);
  const startCanvasRequest = useLatestCanvasRequest();
  const resolveContextAttachment = useCallback(
    (id: string) => {
      const file = contextFiles.find((item) => item.id === id);
      return file && toProjectContextFileAttachment(file, null);
    },
    [contextFiles],
  );
  const {
    selectedContextFileId,
    onContextFileClick: handleContextFileClick,
    onContextFileDownload: handleContextFileDownload,
    closeIfRemoved,
  } = useProjectFilePreview({
    scope: PREVIEW_SCOPE,
    attachmentId,
    openAttachment: openAttachmentCanvas,
    closeCanvas,
    startRequest: startCanvasRequest,
    resolveContextAttachment,
  });

  const { create, isSubmitting } = useCreateProject(projectsClient);
  const picker = useProjectFileManagerPicker(user?.bucket);
  const labels = useProjectCreateFormLabels({
    allowedExtensions,
    maxFileBytes,
  });
  const allowedMimeTypes = useMemo(
    () => getMimeTypesForExtensions(allowedExtensions, MIME_TYPE_EXT_MAP),
    [allowedExtensions],
  );

  const markdownEditorTheme: EditorThemes =
    currentTheme === ThemeId.Dark ? EditorThemes.dark : EditorThemes.light;

  const handleContextFilesChange = useCallback(
    (files: ProjectContextFile[]) => {
      onContextFilesChange(files);
      closeIfRemoved(files);
    },
    [closeIfRemoved, onContextFilesChange],
  );

  const handleLeave = useCallback(() => {
    navigate(ROUTES.Projects);
  }, [navigate]);

  const handleSubmit = useCallback(async () => {
    const name = values.name.trim();
    const outcome = await create({ ...values, name }, newFiles);

    if (outcome.isCreated) {
      showSuccessNotification({
        message: t(ProjectsI18nKeys.CreateToastSuccess, { name }),
      });
      allowNextNavigation();
      navigate(getProjectViewRoute(outcome.project.id));
      return;
    }
    if (outcome.isAborted) return;

    const fieldError = mapProjectCreateError(outcome.code);
    if (fieldError) {
      setErrors((prev) => ({ ...prev, [fieldError.field]: t(fieldError.key) }));
      return;
    }
    showErrorNotification({ message: t(ProjectsI18nKeys.CreateToastError) });
  }, [
    values,
    newFiles,
    create,
    setErrors,
    showSuccessNotification,
    showErrorNotification,
    allowNextNavigation,
    navigate,
    t,
  ]);

  const handleFormSubmit = useCallback(() => {
    void handleSubmit();
  }, [handleSubmit]);

  if (appConfigStatus !== UserConfigStatus.Ready) {
    return <RouteFallback />;
  }

  if (!isEnabled) {
    return <NotFoundPage />;
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

export default memo(ProjectCreatePage);
