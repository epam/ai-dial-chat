import {
  useAttachmentCanvas,
  useLatestCanvasRequest,
  useOpenAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import {
  mapProjectArtifactsToOutputs,
  mapProjectDetailsToViewModel,
  ProjectRefreshOutcome,
} from '@epam/ai-dial-chat-hooks/project';
import { DeleteConfirmationDialog } from '@epam/ai-dial-chat-shared';
import { ProjectOutputs, ProjectView } from '@epam/ai-dial-projects';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import ProjectConversationsSection from '../../components/ProjectConversationsSection/ProjectConversationsSection';
import ProjectShareOverlay from '../../components/ProjectShareOverlay/ProjectShareOverlay';
import PublishProjectPanelContainer from '../../components/PublishProjectPanelContainer/PublishProjectPanelContainer';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import {
  getProjectEditRoute,
  parseProjectRouteParams,
} from '../../constants/routes';
import { ProjectsI18nKeys } from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { useNotification } from '../../context/NotificationContext';
import { useUserConfig } from '../../context/UserConfigContext';
import { useAttachmentCanvasResolvers } from '../../hooks/attachment/useAttachmentCanvasResolvers';
import { useProject } from '../../hooks/projects/useProject';
import { useProjectActions } from '../../hooks/projects/useProjectActions';
import { useProjectArtifacts } from '../../hooks/projects/useProjectArtifacts';
import { useProjectConversations } from '../../hooks/projects/useProjectConversations';
import { useProjectOutputsLabels } from '../../hooks/projects/useProjectOutputsLabels';
import { useProjectViewLabels } from '../../hooks/projects/useProjectViewLabels';
import { useProjectWatch } from '../../hooks/projects/useProjectWatch';
import { useDeleteConfirmationLabels } from '../../hooks/useDeleteConfirmationLabels';
import { ROUTES } from '../../types/routes';
import { UserConfigStatus } from '../../types/user-config-status';
import {
  fromProjectOutputCardId,
  fromProjectPreviewKey,
  toProjectOutputAttachment,
  toProjectOutputCardId,
  toProjectPreviewKey,
  toStoredProjectFileAttachment,
} from '../../utils/project-file-preview';
import NotFoundPage from '../NotFound/NotFound';

const BOLD_COMPONENTS = { bold: <strong /> };

const ProjectViewPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const { status: appConfigStatus } = useAppConfig();
  const isEnabled = useFeatureFlag('projectsEnabled');
  const projectId = parseProjectRouteParams(params);
  const { project, isLoading, hasError, isNotFound, retry, refresh } =
    useProject(projectId, isEnabled);
  const actions = useProjectActions(project, retry);
  const conversations = useProjectConversations(project?.id ?? null);
  const artifacts = useProjectArtifacts(project?.id ?? null);
  const { showInfoNotification } = useNotification();
  const { replacePinnedProjectId } = useUserConfig();

  /* The page's own delete already notifies and leaves; a delete event racing it must not toast twice. */
  const isOwnDeleteRef = useRef(false);
  const hasLeftRef = useRef(false);
  useEffect(() => {
    isOwnDeleteRef.current = actions.isDeleting;
  }, [actions.isDeleting]);
  const handleDeletedElsewhere = useCallback(() => {
    if (isOwnDeleteRef.current || hasLeftRef.current || projectId == null) {
      return;
    }
    hasLeftRef.current = true;
    showInfoNotification({ message: t(ProjectsI18nKeys.ViewDeletedElsewhere) });
    replacePinnedProjectId(projectId, null);
    navigate(ROUTES.Projects, { replace: true });
  }, [navigate, projectId, replacePinnedProjectId, showInfoNotification, t]);
  const { refresh: refreshConversations } = conversations;
  const { refresh: refreshArtifacts } = artifacts;
  const handleProjectChanged = useCallback(async () => {
    const [outcome] = await Promise.all([
      refresh(),
      refreshConversations(),
      refreshArtifacts(),
    ]);
    if (outcome === ProjectRefreshOutcome.NotFound) handleDeletedElsewhere();
  }, [handleDeletedElsewhere, refresh, refreshArtifacts, refreshConversations]);
  useProjectWatch(project?.id ?? null, {
    etag: project?.etag,
    onChange: handleProjectChanged,
    onDelete: handleDeletedElsewhere,
  });
  const labels = useProjectViewLabels();
  const outputsLabels = useProjectOutputsLabels();
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
  /* Opens a context file in the canvas the way the conversation opens an attachment. A saved file's card id is its name. */
  const { attachmentId, closeCanvas } = useAttachmentCanvas();
  const { resolvers, options } = useAttachmentCanvasResolvers();
  const { openAttachmentCanvas } = useOpenAttachmentCanvas(resolvers, options);
  const startCanvasRequest = useLatestCanvasRequest();
  const previewScope = projectId ?? '';
  const selectedCardId = fromProjectPreviewKey(previewScope, attachmentId);
  /* An output's card id is `artifacts/{name}`, which no context file name can match. */
  const selectedOutputName = fromProjectOutputCardId(selectedCardId);
  const selectedContextFileId =
    selectedOutputName == null ? selectedCardId : undefined;
  const handleContextFileClick = useCallback(
    (name: string) => {
      /* The open file's card closes the canvas, as its pressed state says. */
      if (name === selectedContextFileId) {
        closeCanvas();
        return;
      }
      const file = viewModel?.contextFiles.find((item) => item.name === name);
      if (!file || projectId == null) return;
      void openAttachmentCanvas(
        toStoredProjectFileAttachment({ id: name, ...file }, projectId),
        toProjectPreviewKey(previewScope, name),
        startCanvasRequest(),
      );
    },
    [
      closeCanvas,
      selectedContextFileId,
      viewModel,
      projectId,
      previewScope,
      openAttachmentCanvas,
      startCanvasRequest,
    ],
  );
  const outputItems = useMemo(
    () => mapProjectArtifactsToOutputs(artifacts.items),
    [artifacts.items],
  );
  const handleOpenOutput = useCallback(
    (name: string) => {
      if (name === selectedOutputName) {
        closeCanvas();
        return;
      }
      const item = outputItems.find((output) => output.name === name);
      if (!item || projectId == null) return;
      void openAttachmentCanvas(
        toProjectOutputAttachment(item, projectId),
        toProjectPreviewKey(previewScope, toProjectOutputCardId(name)),
        startCanvasRequest(),
      );
    },
    [
      closeCanvas,
      selectedOutputName,
      outputItems,
      projectId,
      previewScope,
      openAttachmentCanvas,
      startCanvasRequest,
    ],
  );
  const canEdit = project?.canEdit ?? false;
  /* Chats deleted from the list since `project` was read; a fresh read resets the count. */
  const [deletedChats, setDeletedChats] = useState({ project, count: 0 });
  const deletedChatCount =
    deletedChats.project === project ? deletedChats.count : 0;
  const conversationCount = Math.max(
    0,
    (project?.conversationCount ?? 0) - deletedChatCount,
  );
  const handleConversationDeleted = useCallback(
    () =>
      setDeletedChats((prev) => ({
        project,
        count: (prev.project === project ? prev.count : 0) + 1,
      })),
    [project],
  );

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
  const { togglePin, downloadArchive, confirmDelete } = actions;
  const handleTogglePin = useCallback(() => {
    void togglePin();
  }, [togglePin]);
  const handleDownload = useCallback(() => {
    void downloadArchive();
  }, [downloadArchive]);
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
          onContextFileClick={handleContextFileClick}
          selectedContextFileId={selectedContextFileId}
          isDetailsStacked={selectedCardId != null}
          onRetry={retry}
          onBrowseProjects={handleBrowseProjects}
          mainContent={
            project ? (
              <ProjectConversationsSection
                projectId={project.id}
                projectName={project.name}
                canEdit={canEdit}
                conversations={conversations}
                onConversationDeleted={handleConversationDeleted}
                /* An Outputs section with files or an error is content of its own, so no "no outputs" empty state under it. */
                hasOutputs={outputItems.length > 0 || artifacts.hasError}
                /* Always mounted: it shows nothing until there are outputs or an error, and keeps its live region in place. */
                outputs={
                  <ProjectOutputs
                    items={outputItems}
                    onOpenOutput={handleOpenOutput}
                    selectedOutputName={selectedOutputName}
                    hasError={artifacts.hasError}
                    onRetry={artifacts.retry}
                    labels={outputsLabels}
                  />
                }
              />
            ) : undefined
          }
          mainContentLabel={t(ProjectsI18nKeys.ViewMainContent)}
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
          conversationCount={conversationCount}
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
            conversationCount > 0 ? (
              <Trans
                i18nKey={
                  ProjectsI18nKeys.ActionsDeleteConfirmWithChatsDescription
                }
                count={conversationCount}
                components={BOLD_COMPONENTS}
              />
            ) : (
              <Trans
                i18nKey={ProjectsI18nKeys.ActionsDeleteConfirmDescription}
                components={BOLD_COMPONENTS}
              />
            )
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
