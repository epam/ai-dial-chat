import type { ConversationResponseDto } from '@epam/ai-dial-chat-api-client';
import {
  attachmentsToDtos,
  findDeploymentByIdOrReference,
  getApiErrorDetails,
  hasActiveToolConfig,
  useToolsMenu,
} from '@epam/ai-dial-chat-hooks';
import type { Attachment, DeploymentItem } from '@epam/ai-dial-chat-shared';
import { ProjectConversationsPanel } from '@epam/ai-dial-projects';
import { DIAL_ICON_SIZE, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconTelescope } from '@tabler/icons-react';
import { memo, useCallback, useEffect, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { getProjectConversationRoute } from '../../constants/routes';
import {
  ProjectsI18nKeys,
  ToolsI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useComposerMenus } from '../../hooks/conversation/useComposerMenus';
import { useLanguage } from '../../hooks/language/useLanguage';
import { useProjectConversations } from '../../hooks/projects/useProjectConversations';
import { useProjectConversationsPanelLabels } from '../../hooks/projects/useProjectConversationsPanelLabels';
import type { ProjectChatProjectSummary } from '../../models/project-chat';
import {
  createProjectConversation,
  saveProjectConversation,
} from '../../server-api/project-conversations.api';
import { ComposerLayout } from '../../types/conversation-composer';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import { resolveLocalizedText } from '../../utils/locale';
import { useDeploymentSelectorOverlay } from '../DeploymentSelector/useDeploymentSelectorOverlay';
import NewConversationComposer, {
  type NewConversationChatSettings,
} from '../NewConversationComposer/NewConversationComposer';

const PROJECT_STORAGE_FULL = 'project-storage-full';

interface Props {
  /** The project whose chats this section lists. */
  projectId: string;
  /** The project's display name, handed to the chat page it opens. */
  projectName: string;
  /** Whether the caller owns the project: only an owner chats, renames and deletes. */
  canEdit: boolean;
}

const ProjectConversationsSection: FC<Props> = ({
  projectId,
  projectName,
  canEdit,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { showErrorNotification, showSuccessNotification } = useNotification();
  const labels = useProjectConversationsPanelLabels();
  const { items, isLoading, hasError, retry, rename, remove } =
    useProjectConversations(projectId);
  const {
    items: deployments,
    selectedItemId,
    setSelectedItemId,
    restoreDefaultSelection,
    selectedDeploymentConfiguration,
    isLoading: isDeploymentsLoading,
    error: deploymentsError,
  } = useDeployments();
  const { renderOverlay, catalogModal } = useDeploymentSelectorOverlay();

  /* A model restored from a viewed chat must not leak into a new project chat, as on the new-conversation screen. */
  useEffect(() => {
    restoreDefaultSelection();
  }, [restoreDefaultSelection]);

  const { toolsMenuItems, onToolToggle, toolConfigurationValue } = useToolsMenu(
    {
      selectedItemId,
      selectedDeploymentConfiguration,
      toolIcon: (
        <IconTelescope
          size={DIAL_ICON_SIZE.SM}
          aria-hidden
          stroke={DIAL_KIT_ICON_STROKE}
        />
      ),
    },
  );
  const selectedDeployment = useMemo(
    () => findDeploymentByIdOrReference(deployments, selectedItemId),
    [deployments, selectedItemId],
  );
  /* Prompts, skills and the `/` menu exactly as on the new-conversation screen. */
  const {
    composerProps,
    modals: composerModals,
    selectedSkills,
    resetSkillMentions,
    seedSkillMentions,
  } = useComposerMenus({
    isSkillsSupported: selectedDeployment?.features?.skillsSupported === true,
  });
  const deploymentItems: DeploymentItem[] = useMemo(
    () =>
      deployments.map(
        ({
          id,
          displayName,
          displayVersion,
          iconUrl,
          type,
          inputAttachmentTypes,
        }) => ({
          id,
          displayName: resolveLocalizedText(displayName, language),
          displayVersion,
          iconUrl: iconUrl ? resolveCatalogIconUrl(iconUrl) : undefined,
          type,
          inputAttachmentTypes,
        }),
      ),
    [deployments, language],
  );

  /* The chat page renders from this instead of waiting for the project details, which read the whole project. */
  const project: ProjectChatProjectSummary = useMemo(
    () => ({ id: projectId, name: projectName, canEdit }),
    [projectId, projectName, canEdit],
  );

  const handleCreateConversation = useCallback(
    async (
      message: string,
      attachments: Attachment[],
      chatSettingsValues: NewConversationChatSettings,
    ) => {
      if (!selectedItemId) {
        return;
      }
      const skillsForSend = selectedSkills;
      resetSkillMentions();
      let conversation: ConversationResponseDto;
      try {
        conversation = await createProjectConversation(
          projectId,
          message,
          selectedItemId,
          attachmentsToDtos(attachments || []),
          hasActiveToolConfig(toolConfigurationValue)
            ? toolConfigurationValue
            : undefined,
          undefined,
          skillsForSend,
        );
      } catch (error) {
        seedSkillMentions(message, skillsForSend);
        const { code, traceId } = await getApiErrorDetails(error);
        showErrorNotification({
          message: t(
            code === PROJECT_STORAGE_FULL
              ? ProjectsI18nKeys.ChatsStorageFull
              : ProjectsI18nKeys.ChatsCreateError,
          ),
          requestId: traceId,
        });
        /* Rejecting keeps the draft in the composer. */
        throw error;
      }
      const savedConversation = {
        ...conversation,
        prompt: chatSettingsValues.systemPrompt,
        temperature: chatSettingsValues.temperature,
        responseFormat: chatSettingsValues.responseFormat,
      } as ConversationResponseDto;
      try {
        await saveProjectConversation(conversation.id, savedConversation);
      } finally {
        /* The chat exists either way; opening it avoids a duplicate on retry. */
        navigate(getProjectConversationRoute(conversation.id), {
          state: { conversation: savedConversation, project },
        });
      }
    },
    [
      navigate,
      project,
      projectId,
      resetSkillMentions,
      seedSkillMentions,
      selectedItemId,
      selectedSkills,
      showErrorNotification,
      t,
      toolConfigurationValue,
    ],
  );

  const handleOpen = useCallback(
    (id: string) =>
      navigate(getProjectConversationRoute(id), { state: { project } }),
    [navigate, project],
  );

  const handleRename = useCallback(
    async (id: string, newTitle: string) => {
      try {
        await rename(id, newTitle);
        showSuccessNotification({
          message: t(ProjectsI18nKeys.ChatsRenameSuccess),
        });
      } catch (error) {
        const { traceId } = await getApiErrorDetails(error);
        showErrorNotification({
          message: t(ProjectsI18nKeys.ChatsRenameError),
          requestId: traceId,
        });
        throw error;
      }
    },
    [rename, showErrorNotification, showSuccessNotification, t],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await remove(id);
        showSuccessNotification({
          message: t(ProjectsI18nKeys.ChatsDeleteSuccess),
        });
      } catch (error) {
        const { traceId } = await getApiErrorDetails(error);
        showErrorNotification({
          message: t(ProjectsI18nKeys.ChatsDeleteError),
          requestId: traceId,
        });
        throw error;
      }
    },
    [remove, showErrorNotification, showSuccessNotification, t],
  );

  return (
    <>
      <ProjectConversationsPanel
        composer={
          canEdit ? (
            <NewConversationComposer
              {...composerProps}
              layout={ComposerLayout.Embedded}
              deployments={deploymentItems}
              selectedDeploymentId={selectedItemId}
              onDeploymentChange={setSelectedItemId}
              selectedDeployment={selectedDeployment}
              isInputDisabled={
                !!selectedDeploymentConfiguration?.isChatMessageInputDisabled
              }
              isModelSelectorLoading={isDeploymentsLoading}
              modelSelectorError={deploymentsError}
              placeholder={t(ProjectsI18nKeys.ChatsInputPlaceholder)}
              onCreateConversation={handleCreateConversation}
              modelPickerOverlay={renderOverlay}
              toolsMenuItems={toolsMenuItems}
              onToolToggle={onToolToggle}
              toolsMenuTitle={t(ToolsI18nKeys.MenuTitle)}
              toolsChipLabels={{
                removeLabel: (label) => t(ToolsI18nKeys.RemoveTool, { label }),
                stateOnLabel: t(ToolsI18nKeys.StateOn),
                stateOffLabel: t(ToolsI18nKeys.StateOff),
              }}
            />
          ) : undefined
        }
        items={items}
        isLoading={isLoading}
        hasError={hasError}
        onRetry={retry}
        onOpen={handleOpen}
        onRename={canEdit ? handleRename : undefined}
        onDelete={canEdit ? handleDelete : undefined}
        labels={labels}
      />
      {catalogModal}
      {composerModals}
    </>
  );
};

export default memo(ProjectConversationsSection);
