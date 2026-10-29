import type { ScheduledTaskDto } from '@epam/ai-dial-chat-api-client';
import { findDeploymentByIdOrReference } from '@epam/ai-dial-chat-hooks';
import {
  ScheduledTaskConversationDetailsSection,
  ScheduledTaskConversationDetailsState,
} from '@epam/ai-dial-scheduled-tasks';
import { memo, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ChatI18nKeys,
  ScheduledTasksI18nKeys,
} from '../../../constants/translation-keys';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useSourcesSidebarData } from '../../../context/SourcesSidebarContext';
import { useLanguage } from '../../../hooks/language/useLanguage';
import { useScheduledTaskSkillDisplayNames } from '../../../hooks/scheduled-tasks/useScheduledTaskSkillDisplayNames';
import { ActiveScheduledTaskDetailState } from '../../../types/active-scheduled-task';
import { resolveLocalizedText } from '../../../utils/locale';

/* Maps the app's fetch status to the lib section's display state; idle/loading resolve to the summary branch. */
const DETAIL_STATE_MAP: Record<
  ActiveScheduledTaskDetailState,
  ScheduledTaskConversationDetailsState
> = {
  [ActiveScheduledTaskDetailState.Idle]:
    ScheduledTaskConversationDetailsState.Ready,
  [ActiveScheduledTaskDetailState.Loading]:
    ScheduledTaskConversationDetailsState.Ready,
  [ActiveScheduledTaskDetailState.Success]:
    ScheduledTaskConversationDetailsState.Ready,
  [ActiveScheduledTaskDetailState.Error]:
    ScheduledTaskConversationDetailsState.Error,
  [ActiveScheduledTaskDetailState.Unavailable]:
    ScheduledTaskConversationDetailsState.Unavailable,
};

interface Props {
  /** Resolved task details, or `null` while loading/failed. */
  task: ScheduledTaskDto | null;
  /** Fetch status of the task's own details. */
  taskState: ActiveScheduledTaskDetailState;
  /** Re-fetches the task's details after an error. */
  onRetry: () => void;
  /** Active schedule id — the expanded state resets whenever it changes. */
  scheduleId?: string;
}

/*
 * App adapter for the lib's Details accordion: owns the deployment-name
 * resolution, the skill display names, and the localized labels, and hands
 * the resolved values to the host-agnostic
 * `ScheduledTaskConversationDetailsSection`.
 */
const TaskDetailsSection: FC<Props> = ({
  task,
  taskState,
  onRetry,
  scheduleId,
}) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { conversationModelId } = useSourcesSidebarData();
  const { items: deploymentItems } = useDeployments();
  const skillDisplayNames = useScheduledTaskSkillDisplayNames(task?.skillUrls);

  /*
   * The section describes this run, so its Model field must show the
   * deployment the run actually used — the run conversation's own model id,
   * already published to the sources sidebar with its messages — not the
   * schedule's current `model`, which a later edit may have changed after
   * this run fired.
   */
  const modelDisplayName = useMemo(() => {
    if (!conversationModelId) return undefined;
    const deployment = findDeploymentByIdOrReference(
      deploymentItems,
      conversationModelId,
    );
    return deployment
      ? resolveLocalizedText(deployment.displayName, language) ||
          conversationModelId
      : conversationModelId;
  }, [conversationModelId, deploymentItems, language]);

  const labels = useMemo(
    () => ({
      title: t(ScheduledTasksI18nKeys.CreateDetailsSectionTitle),
      modelLabel: t(ScheduledTasksI18nKeys.ConversationPanelModelLabel),
      instructionsLabel: t(ScheduledTasksI18nKeys.CreateInstructionsLabel),
      skillLabel: t(ScheduledTasksI18nKeys.CreateSkillLabel),
      unavailableLabel: t(
        ScheduledTasksI18nKeys.ConversationBannerUnavailableLabel,
      ),
      retryLabel: t(ButtonsI18nKeys.Retry),
    }),
    [t],
  );

  /* The lib section's built-in viewer defaults to the panel's 14/20 instructions scale, so only its control labels need naming here. */
  const markdownLabels = useMemo(
    () => ({
      codeBlockCopyLabel: t(ButtonsI18nKeys.Copy),
      codeBlockCopiedLabel: t(ButtonsI18nKeys.Copied),
      codeBlockDownloadLabel: t(ButtonsI18nKeys.Download),
      tableScrollRegionAriaLabel: t(ChatI18nKeys.ScrollableTable),
      mathScrollRegionAriaLabel: t(ChatI18nKeys.ScrollableFormula),
    }),
    [t],
  );

  return (
    <ScheduledTaskConversationDetailsSection
      scheduleId={scheduleId}
      state={DETAIL_STATE_MAP[taskState]}
      onRetry={onRetry}
      modelDisplayName={modelDisplayName}
      skillDisplayNames={skillDisplayNames}
      instructionsMarkdown={task?.prompt}
      markdownLabels={markdownLabels}
      labels={labels}
    />
  );
};

export default memo(TaskDetailsSection);
