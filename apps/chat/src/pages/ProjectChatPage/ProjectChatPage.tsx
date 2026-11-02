import { useIsMobile } from '@epam/ai-dial-chat-shared';
import { ProjectChatHeader } from '@epam/ai-dial-projects';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  PrimaryButton,
  Spinner,
  StateScreen,
} from '@epam/ai-dial-ui-kit';
import { IconAlertTriangle } from '@tabler/icons-react';
import {
  memo,
  useCallback,
  useMemo,
  useState,
  type FC,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import {
  getProjectViewRoute,
  parseProjectConversationRouteParams,
} from '../../constants/routes';
import { ProjectsI18nKeys } from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { useChatLayoutHeaderSlot } from '../../context/ChatLayoutHeaderSlotContext';
import { ConversationDataSourceContext } from '../../context/ConversationDataSourceContext';
import { useProject } from '../../hooks/projects/useProject';
import type {
  ProjectChatNavigationState,
  ProjectChatProjectSummary,
} from '../../models/project-chat';
import { ROUTES } from '../../types/routes';
import { UserConfigStatus } from '../../types/user-config-status';
import { createProjectConversationDataSource } from '../../utils/project-conversation-data-source';
import { ConversationPage } from '../Conversation/Conversation';
import NotFoundPage from '../NotFound/NotFound';

const ProjectChatPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { bucket, '*': splat } = useParams();
  const { state } = useLocation();
  const headerSlot = useChatLayoutHeaderSlot();
  const isMobile = useIsMobile();
  /* Captured once: the conversation page clears the router state right after mount. */
  const [navigationProject] = useState(
    () => (state as ProjectChatNavigationState | null)?.project ?? null,
  );
  const { status: appConfigStatus } = useAppConfig();
  const isEnabled = useFeatureFlag('projectsEnabled');
  const route = useMemo(
    () => parseProjectConversationRouteParams({ bucket, '*': splat }),
    [bucket, splat],
  );
  const projectId = route?.projectId ?? null;
  const { project, isNotFound, hasError } = useProject(projectId, isEnabled);
  /*
   * The opening page's project renders the chat at once; the details, which
   * read the whole project archive, replace it when they arrive.
   */
  const summary: ProjectChatProjectSummary | null = useMemo(() => {
    if (project) {
      return { id: project.id, name: project.name, canEdit: project.canEdit };
    }
    return navigationProject?.id === projectId ? navigationProject : null;
  }, [project, navigationProject, projectId]);
  const canEdit = summary?.canEdit ?? false;
  /* Keyed by project and permission only, so the page's effects do not re-run on each render. */
  const dataSource = useMemo(
    () =>
      projectId
        ? createProjectConversationDataSource({ projectId, canEdit })
        : null,
    [projectId, canEdit],
  );

  const handleBack = useCallback(() => {
    if (projectId) navigate(getProjectViewRoute(projectId));
  }, [navigate, projectId]);
  const handleProjectLinkClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      handleBack();
    },
    [handleBack],
  );
  const handleBrowseProjects = useCallback(
    () => navigate(ROUTES.Projects),
    [navigate],
  );

  if (appConfigStatus !== UserConfigStatus.Ready) {
    return <RouteFallback />;
  }

  if (!isEnabled) {
    return <NotFoundPage />;
  }

  if (!route || !dataSource || isNotFound || (hasError && !summary)) {
    return (
      <div className="flex size-full items-center justify-center p-4">
        <StateScreen
          icon={
            <IconAlertTriangle
              aria-hidden
              size={DIAL_ICON_SIZE.LG}
              stroke={DIAL_KIT_ICON_STROKE}
            />
          }
          title={t(ProjectsI18nKeys.ViewNotFound)}
          action={
            <PrimaryButton
              label={t(ProjectsI18nKeys.ViewBrowseProjects)}
              onClick={handleBrowseProjects}
            />
          }
        />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex size-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  /* On desktop the breadcrumb takes the layout's top bar, beside the sources toggle, instead of a second bar. */
  const isHeaderInLayout = headerSlot != null && !isMobile;
  const header = (
    <ProjectChatHeader
      projectName={summary.name}
      projectHref={getProjectViewRoute(summary.id)}
      onBack={handleBack}
      onProjectLinkClick={handleProjectLinkClick}
      backLabel={t(ProjectsI18nKeys.ChatBackToProject, {
        name: summary.name,
      })}
      className={
        isHeaderInLayout
          ? 'border-0 p-0 text-primary'
          : 'border-tertiary text-primary'
      }
    />
  );

  return (
    <div className="flex size-full min-h-0 flex-col">
      {isHeaderInLayout ? createPortal(header, headerSlot) : header}
      <div className="min-h-0 flex-1">
        <ConversationDataSourceContext.Provider value={dataSource}>
          <ConversationPage conversationId={route.conversationId} />
        </ConversationDataSourceContext.Provider>
      </div>
    </div>
  );
};

export default memo(ProjectChatPage);
