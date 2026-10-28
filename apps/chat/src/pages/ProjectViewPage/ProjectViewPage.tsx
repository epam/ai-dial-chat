import { DeleteConfirmationDialog } from '@epam/ai-dial-chat-shared';
import { ProjectView } from '@epam/ai-dial-projects';
import { memo, useCallback, useMemo, useRef, useState, type FC } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import ProjectShareOverlay from '../../components/ProjectShareOverlay/ProjectShareOverlay';
import PublishProjectPanelContainer from '../../components/PublishProjectPanelContainer/PublishProjectPanelContainer';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import {
  getProjectEditRoute,
  parseProjectRouteParams,
} from '../../constants/routes';
import { ProjectsI18nKeys } from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { useProject } from '../../hooks/projects/useProject';
import { useProjectActions } from '../../hooks/projects/useProjectActions';
import { useProjectViewLabels } from '../../hooks/projects/useProjectViewLabels';
import { useDeleteConfirmationLabels } from '../../hooks/useDeleteConfirmationLabels';
import { ROUTES } from '../../types/routes';
import { UserConfigStatus } from '../../types/user-config-status';
import { mapProjectDetailsToViewModel } from '../../utils/map-project-dto';
import NotFoundPage from '../NotFound/NotFound';

const BOLD_COMPONENTS = { bold: <strong /> };

const ProjectViewPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const { status: appConfigStatus } = useAppConfig();
  const isEnabled = useFeatureFlag('projectsEnabled');
  const projectId = parseProjectRouteParams(params);
  const { project, isLoading, hasError, isNotFound, retry } = useProject(
    projectId,
    isEnabled,
  );
  const actions = useProjectActions(project, retry);
  const labels = useProjectViewLabels();
  const deleteLabels = useDeleteConfirmationLabels();

  const [contextSearchQuery, setContextSearchQuery] = useState('');
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  /* The publish panel loads the public folder tree on mount, so it mounts on
   * the first open and then stays mounted for its slide-out animation. */
  const [hasOpenedPublish, setHasOpenedPublish] = useState(false);
  const publishTriggerRef = useRef<HTMLElement | null>(null);

  const viewModel = useMemo(
    () => (project ? mapProjectDetailsToViewModel(project) : null),
    [project],
  );
  const canEdit = project?.canEdit ?? false;

  const handleBrowseProjects = useCallback(
    () => navigate(ROUTES.Projects),
    [navigate],
  );
  const handleEdit = useCallback(() => {
    if (projectId) navigate(getProjectEditRoute(projectId));
  }, [navigate, projectId]);
  const handleShare = useCallback(() => setIsShareOpen(true), []);
  const handleCloseShare = useCallback(() => setIsShareOpen(false), []);
  const handlePublish = useCallback(() => {
    /* The panel returns focus to whatever opened it. */
    publishTriggerRef.current = document.activeElement as HTMLElement | null;
    setHasOpenedPublish(true);
    setIsPublishOpen(true);
  }, []);
  const handleClosePublish = useCallback(() => setIsPublishOpen(false), []);
  const { togglePin, downloadArchive, openFile, confirmDelete } = actions;
  const handleTogglePin = useCallback(() => {
    void togglePin();
  }, [togglePin]);
  const handleDownload = useCallback(() => {
    void downloadArchive();
  }, [downloadArchive]);
  const handleOpenFile = useCallback(
    (fileName: string) => {
      void openFile(fileName);
    },
    [openFile],
  );
  const handleConfirmDelete = useCallback(() => {
    void confirmDelete();
  }, [confirmDelete]);

  if (appConfigStatus !== UserConfigStatus.Ready) {
    return <RouteFallback />;
  }

  if (!isEnabled) {
    return <NotFoundPage />;
  }

  return (
    <>
      {/* The share overlay is modal: the page behind leaves the tab order and
       * the accessibility tree while it is open. */}
      <div className="contents" inert={isShareOpen}>
        <ProjectView
          project={viewModel}
          isLoading={isLoading}
          hasError={hasError}
          isNotFound={isNotFound || projectId == null}
          isPinned={actions.isPinned}
          isPinPending={actions.isPinPending}
          contextSearchQuery={contextSearchQuery}
          onContextSearchQueryChange={setContextSearchQuery}
          onBack={handleBrowseProjects}
          onTogglePin={handleTogglePin}
          onPublish={canEdit ? handlePublish : undefined}
          onEdit={canEdit ? handleEdit : undefined}
          onShare={canEdit ? handleShare : undefined}
          onDelete={canEdit ? actions.requestDelete : undefined}
          onDownload={handleDownload}
          onOpenFile={handleOpenFile}
          onRetry={retry}
          onBrowseProjects={handleBrowseProjects}
          labels={labels}
        />
      </div>
      {project && isShareOpen && (
        <ProjectShareOverlay
          projectId={project.id}
          onClose={handleCloseShare}
        />
      )}
      {project && canEdit && hasOpenedPublish && (
        <PublishProjectPanelContainer
          isOpen={isPublishOpen}
          projectId={project.id}
          projectName={project.name}
          onClose={handleClosePublish}
          returnFocusRef={publishTriggerRef}
        />
      )}
      {project && (
        <DeleteConfirmationDialog
          open={actions.isDeleteOpen}
          title={t(ProjectsI18nKeys.ActionsDeleteConfirmTitle, {
            name: project.name,
          })}
          names={[project.name]}
          message={
            <Trans
              i18nKey={ProjectsI18nKeys.ActionsDeleteConfirmDescription}
              components={BOLD_COMPONENTS}
            />
          }
          labels={deleteLabels}
          isLoading={actions.isDeleting}
          onConfirm={handleConfirmDelete}
          onClose={actions.cancelDelete}
        />
      )}
    </>
  );
};

export default memo(ProjectViewPage);
