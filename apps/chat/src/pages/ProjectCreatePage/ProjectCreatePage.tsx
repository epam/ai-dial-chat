import { TextRefinementPurpose } from '@epam/ai-dial-chat-api-client';
import { MIME_TYPE_EXT_MAP } from '@epam/ai-dial-chat-shared';
import {
  isStoredContextFile,
  ProjectCreateForm,
  type ProjectContextFile,
  type ProjectCreateFormErrors,
  type ProjectCreateFormValues,
} from '@epam/ai-dial-projects';
import { EditorThemes } from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useMemo, useState, type FC } from 'react';
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
import { useCreateProject } from '../../hooks/projects/useCreateProject';
import { useProjectCreateFormLabels } from '../../hooks/projects/useProjectCreateFormLabels';
import { useProjectFileManagerPicker } from '../../hooks/projects/useProjectFileManagerPicker';
import { useBuilderLeaveGuard } from '../../hooks/unsaved-changes/useBuilderLeaveGuard';
import { useTextRefinementCallback } from '../../hooks/useTextRefinementCallback';
import { ROUTES } from '../../types/routes';
import { ThemeId } from '../../types/theme-id';
import { UserConfigStatus } from '../../types/user-config-status';
import { mapProjectCreateError } from '../../utils/project-create-errors';
import { getMimeTypesForExtensions } from '../../utils/project-limits';
import NotFoundPage from '../NotFound/NotFound';

const DEFAULT_VALUES: ProjectCreateFormValues = {
  name: '',
  description: '',
  instructions: '',
};

const ProjectCreatePage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { config, status: appConfigStatus } = useAppConfig();
  const isEnabled = useFeatureFlag('projectsEnabled');
  const { user } = useUser();
  const { currentTheme } = useTheme();
  const { showSuccessNotification, showErrorNotification } = useNotification();
  const onRefineDescription = useTextRefinementCallback(
    TextRefinementPurpose.ProjectDescription,
  );
  const onRefineInstructions = useTextRefinementCallback(
    TextRefinementPurpose.ProjectInstructions,
  );

  const {
    projectContextAllowedExtensions: allowedExtensions,
    projectContextFileMaxBytes: maxFileBytes,
    projectContextTotalMaxBytes: maxTotalBytes,
  } = config;

  const [values, setValues] = useState<ProjectCreateFormValues>(DEFAULT_VALUES);
  const [contextFiles, setContextFiles] = useState<ProjectContextFile[]>([]);
  const [errors, setErrors] = useState<ProjectCreateFormErrors>({});

  /* The page owns the unsaved-changes guard, as `ScheduledTaskCreatePage`
   * does: in-app navigation asks for confirmation and `beforeunload` is armed
   * while anything was entered. */
  const isDirty =
    values.name !== '' ||
    values.description !== '' ||
    values.instructions !== '' ||
    contextFiles.length > 0;
  const { allowNextNavigation } = useBuilderLeaveGuard({ isDirty });

  const { create, isSubmitting } = useCreateProject();
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

  const handleFieldChange = useCallback(
    <K extends keyof ProjectCreateFormValues>(
      field: K,
      value: ProjectCreateFormValues[K],
    ) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      if (field === 'name') {
        setErrors((prev) => (prev.name ? { ...prev, name: undefined } : prev));
      }
    },
    [],
  );

  const handleContextFilesChange = useCallback(
    (files: ProjectContextFile[]) => {
      setContextFiles(files);
      setErrors((prev) =>
        prev.context ? { ...prev, context: undefined } : prev,
      );
    },
    [],
  );

  const handleLeave = useCallback(() => {
    navigate(ROUTES.Projects);
  }, [navigate]);

  const handleSubmit = useCallback(async () => {
    const name = values.name.trim();
    const outcome = await create(
      { ...values, name },
      /* A new project has no stored files; the guard narrows the union. */
      contextFiles.flatMap((file) =>
        isStoredContextFile(file) ? [] : [file.file],
      ),
    );

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
    contextFiles,
    create,
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
        allowedExtensions={allowedExtensions}
        maxFileBytes={maxFileBytes}
        maxTotalBytes={maxTotalBytes}
        onPickFromFileManager={
          user?.bucket ? picker.pickFromFileManager : undefined
        }
        onRefineDescription={onRefineDescription}
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
