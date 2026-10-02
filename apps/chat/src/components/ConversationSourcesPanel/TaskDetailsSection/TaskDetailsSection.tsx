import type { ScheduledTaskDto } from '@epam/ai-dial-chat-api-client';
import { findDeploymentByIdOrReference } from '@epam/ai-dial-chat-hooks';
import {
  MDMessageViewer,
  type MarkdownRendererClassNames,
} from '@epam/ai-dial-chat-shared';
import { ScheduledTaskDetailsSummary } from '@epam/ai-dial-scheduled-tasks';
import { Accordion, GhostButton } from '@epam/ai-dial-ui-kit';
import { memo, useEffect, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ScheduledTasksI18nKeys,
} from '../../../constants/translation-keys';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useSourcesSidebarData } from '../../../context/SourcesSidebarContext';
import { useLanguage } from '../../../hooks/language/useLanguage';
import { useScheduledTaskSkillDisplayNames } from '../../../hooks/scheduled-tasks/useScheduledTaskSkillDisplayNames';
import { ActiveScheduledTaskDetailState } from '../../../types/active-scheduled-task';
import { resolveLocalizedText } from '../../../utils/locale';

/*
 * The Instructions value is short task prose inside the narrow side panel,
 * so its text sits on the small scale (14/20) the panel's other values use,
 * one step down from the markdown default. Module-level so the memoized
 * `MDMessageViewer` receives a stable reference.
 */
const INSTRUCTIONS_CLASS_NAMES: MarkdownRendererClassNames = {
  h1: 'dial-small-semi-text mb-3 mt-6 first:mt-0 [text-wrap:balance]',
  h2: 'dial-small-semi-text mb-2 mt-5 first:mt-0 [text-wrap:balance]',
  h3: 'dial-small-semi-text mb-2 mt-4 first:mt-0 [text-wrap:balance]',
  h4: 'dial-small-semi-text mb-2 mt-4 first:mt-0 [text-wrap:balance]',
  h5: 'dial-small-semi-text mb-2 mt-4 first:mt-0 [text-wrap:balance]',
  h6: 'dial-small-semi-text mb-2 mt-4 first:mt-0 [text-wrap:balance]',
  p: 'dial-small-text mb-3 break-words [overflow-wrap:anywhere] [text-wrap:pretty] last:mb-0',
  ul: 'dial-small-text mb-3 space-y-1',
  ol: 'dial-small-text mb-3 space-y-1',
  codeInline: 'mx-0.5 px-1.5 break-words [overflow-wrap:anywhere]',
  blockquote: 'my-4',
  link: 'break-words [overflow-wrap:anywhere]',
  tableWrapper: 'my-4',
  mathBlock: 'my-4',
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
 * Details accordion of a task conversation's sources panel: the run's own
 * Model/Skill/Instructions summary, or the scoped unavailable/retry state
 * while the task's details cannot load. Owns the deployment-name resolution
 * and the expanded-state reset on schedule change.
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

  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsExpanded(false);
  }, [scheduleId]);

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

  const content =
    taskState === ActiveScheduledTaskDetailState.Error ||
    taskState === ActiveScheduledTaskDetailState.Unavailable ? (
      <div className="flex flex-col items-start gap-2">
        <p role="alert" className="dial-body-text text-secondary">
          {t(ScheduledTasksI18nKeys.ConversationBannerUnavailableLabel)}
        </p>
        {taskState === ActiveScheduledTaskDetailState.Error && (
          <GhostButton
            label={t(ScheduledTasksI18nKeys.ListRetryLabel)}
            onClick={onRetry}
          />
        )}
      </div>
    ) : (
      <ScheduledTaskDetailsSummary
        modelLabel={t(ScheduledTasksI18nKeys.ConversationPanelModelLabel)}
        instructionsLabel={t(ScheduledTasksI18nKeys.CreateInstructionsLabel)}
        skillLabel={t(ScheduledTasksI18nKeys.CreateSkillLabel)}
        skillDisplayNames={skillDisplayNames}
        modelDisplayName={modelDisplayName}
        instructionsMarkdown={task?.prompt}
        renderInstructions={(markdown) => (
          <MDMessageViewer
            content={markdown}
            classNames={INSTRUCTIONS_CLASS_NAMES}
            codeBlockCopyLabel={t(ButtonsI18nKeys.Copy)}
            codeBlockCopiedLabel={t(ButtonsI18nKeys.Copied)}
            codeBlockDownloadLabel={t(ButtonsI18nKeys.Download)}
          />
        )}
      />
    );

  return (
    <Accordion
      title={
        /*
         * `block` breaks the title out of the kit's `dial-body-text` strut
         * (line-height 24) so its own 12/16 line-height applies; `py-1` grows
         * the block to the design's 24px title height, text centered.
         */
        <span className="dial-tiny-semi-text block truncate py-1">
          {t(ScheduledTasksI18nKeys.CreateDetailsSectionTitle)}
        </span>
      }
      expanded={isExpanded}
      onToggle={setIsExpanded}
    >
      {content}
    </Accordion>
  );
};

export default memo(TaskDetailsSection);
