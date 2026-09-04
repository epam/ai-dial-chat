import { useOpenAttachmentCanvas } from '@epam/ai-dial-attachment-canvas';
import {
  useAttachmentAction,
  useConversationSources,
  usePanelMaxWidth,
  isDownloadableAttachment,
  isDialFileId,
  isExternalSourcePreviewable,
  resolveExternalSourceContentType,
  downloadAttachment as triggerAttachmentDownload,
} from '@epam/ai-dial-chat-hooks';
import type {
  AttachmentDisplayResolvers,
  DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import {
  MDMessageViewer,
  AttachmentType,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import {
  ScheduledTaskDetailsSummary,
  ScheduledTaskRunHistoryList,
  type ScheduledTaskRunItem,
} from '@epam/ai-dial-scheduled-tasks';
import { ConversationSourcesPanel } from '@epam/ai-dial-source-panel';
import type { QuotationSource } from '@epam/ai-dial-source-panel';
import { ButtonVariant, Accordion, GhostButton } from '@epam/ai-dial-ui-kit';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { MIN_CONTENT_AREA_WIDTH } from '../../constants/layout';
import { getConversationRoute } from '../../constants/routes';
import {
  AttachmentsI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  ConversationPanelI18nKeys,
  ScheduledTasksI18nKeys,
  SidebarI18nKeys,
} from '../../constants/translation-keys';
import { useActiveScheduledTask } from '../../context/ActiveScheduledTaskContext';
import { useConversations } from '../../context/ConversationsContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';
import { useAttachmentCanvasResolvers } from '../../hooks/attachment/useAttachmentCanvasResolvers';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useLanguage } from '../../hooks/language/useLanguage';
import useLocalStorage from '../../hooks/useLocalStorage';
import {
  ActiveScheduledTaskDetailState,
  ActiveScheduledTaskStatus,
} from '../../types/active-scheduled-task';
import { StorageKey } from '../../types/storage-key';
import { resolveDialFileDownloadUrl } from '../../utils/dial-file';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import { resolveLocalizedText } from '../../utils/locale';
import { mapScheduledTaskRunDtosToItems } from '../../utils/map-scheduled-task-run-dto';

const MIN_PANEL_WIDTH = 312;
const DEFAULT_PANEL_WIDTH = 360;
/** Delay between successive triggered downloads so browsers don't block a burst of anchor clicks. */
const DOWNLOAD_ALL_STAGGER_MS = 150;

/* Stable references so useConversationSources'/useAttachmentAction's memoization isn't defeated by a new object/function each render. */
const attachmentDisplayResolvers: AttachmentDisplayResolvers = {
  resolvePreviewUrl: (dto) => resolveCatalogIconUrl(dto.url),
  resolvePlayUrl: (dto) => dto.url && resolveDialFileDownloadUrl(dto.url),
};

const ConversationSourcesPanelContainer: FC = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { handleClose, isOpen, messages } = useSourcesSidebar();
  const { uploaded, generated, sources } = useConversationSources(
    messages,
    attachmentDisplayResolvers,
  );
  const { handleAttachmentClick: downloadAttachment } = useAttachmentAction({
    resolveDownloadUrl: resolveDialFileDownloadUrl,
  });
  const { resolvers, options } = useAttachmentCanvasResolvers();
  const { openAttachmentCanvas } = useOpenAttachmentCanvas(resolvers, options);
  const activeScheduledTask = useActiveScheduledTask();
  const { items: deploymentItems } = useDeployments();
  const { conversations } = useConversations();
  const navigate = useNavigate();
  const isTaskConversation =
    activeScheduledTask.status === ActiveScheduledTaskStatus.TaskConversation;

  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  useEffect(() => {
    setIsHistoryExpanded(true);
    setIsDetailsExpanded(false);
  }, [activeScheduledTask.scheduleId]);

  const runItems = useMemo(
    () =>
      mapScheduledTaskRunDtosToItems(
        activeScheduledTask.history.items,
        t,
        conversations,
      ),
    [activeScheduledTask.history.items, t, conversations],
  );

  const handleRunClick = useCallback(
    (run: ScheduledTaskRunItem) => {
      if (!run.conversationId) return;
      navigate(getConversationRoute(run.conversationId));
    },
    [navigate],
  );

  const taskModel = activeScheduledTask.task?.model;
  const modelDisplayName = useMemo(() => {
    if (!taskModel) return undefined;
    const deployment = deploymentItems.find((item) => item.id === taskModel);
    return deployment
      ? resolveLocalizedText(deployment.displayName, language) || taskModel
      : taskModel;
  }, [taskModel, deploymentItems, language]);

  const historyLabels = useMemo(
    () => ({
      historyTitle: t(ScheduledTasksI18nKeys.DetailHistoryTitle),
      emptyLabel: t(ScheduledTasksI18nKeys.DetailHistoryEmptyLabel),
      errorLabel: t(ScheduledTasksI18nKeys.DetailHistoryErrorLabel),
      retryLabel: t(ScheduledTasksI18nKeys.ListRetryLabel),
      runStatusLabels: {
        success: t(ScheduledTasksI18nKeys.DetailStatusSuccess),
        error: t(ScheduledTasksI18nKeys.DetailStatusError),
        inProgress: t(ScheduledTasksI18nKeys.DetailStatusInProgress),
        missed: t(ScheduledTasksI18nKeys.DetailStatusMissed),
      },
      currentRunLabel: t(
        ScheduledTasksI18nKeys.ConversationPanelCurrentRunLabel,
      ),
      unreadIndicatorLabel: t(ConversationPanelI18nKeys.UnreadIndicatorLabel),
    }),
    [t],
  );

  const historyFooter =
    activeScheduledTask.history.hasMore &&
    !activeScheduledTask.history.isLoading ? (
      <li className="pt-2">
        <GhostButton
          variant={ButtonVariant.Primary}
          label={t(ButtonsI18nKeys.ShowMore)}
          onClick={activeScheduledTask.history.loadMore}
          disabled={activeScheduledTask.history.isLoadingMore}
        />
      </li>
    ) : undefined;

  const detailsContent =
    activeScheduledTask.taskState === ActiveScheduledTaskDetailState.Error ||
    activeScheduledTask.taskState ===
      ActiveScheduledTaskDetailState.Unavailable ? (
      <div className="flex flex-col items-start gap-2">
        <p role="alert" className="dial-body-text text-secondary">
          {t(ScheduledTasksI18nKeys.ConversationBannerUnavailableLabel)}
        </p>
        {activeScheduledTask.taskState ===
          ActiveScheduledTaskDetailState.Error && (
          <GhostButton
            label={t(ScheduledTasksI18nKeys.ListRetryLabel)}
            onClick={activeScheduledTask.retryTask}
          />
        )}
      </div>
    ) : (
      <ScheduledTaskDetailsSummary
        modelLabel={t(ScheduledTasksI18nKeys.ConversationPanelModelLabel)}
        instructionsLabel={t(ScheduledTasksI18nKeys.CreateInstructionsLabel)}
        modelDisplayName={modelDisplayName as string}
        instructionsMarkdown={activeScheduledTask.task?.prompt}
        renderInstructions={(markdown) => (
          <MDMessageViewer content={markdown} />
        )}
      />
    );

  const additionalSections = isTaskConversation ? (
    <>
      <Accordion
        title={t(ScheduledTasksI18nKeys.DetailHistoryTitle)}
        expanded={isHistoryExpanded}
        onToggle={setIsHistoryExpanded}
      >
        <div inert={!isHistoryExpanded}>
          <ScheduledTaskRunHistoryList
            items={runItems}
            isLoading={activeScheduledTask.history.isLoading}
            isLoadingMore={activeScheduledTask.history.isLoadingMore}
            error={activeScheduledTask.history.error}
            onRetry={activeScheduledTask.history.refetch}
            currentRunId={activeScheduledTask.runId}
            onRunClick={handleRunClick}
            labels={historyLabels}
            footer={historyFooter}
          />
        </div>
      </Accordion>
      <Accordion
        title={t(ScheduledTasksI18nKeys.CreateDetailsSectionTitle)}
        expanded={isDetailsExpanded}
        onToggle={setIsDetailsExpanded}
      >
        <div inert={!isDetailsExpanded}>{detailsContent}</div>
      </Accordion>
    </>
  ) : undefined;

  let panelTitle: string | undefined;
  if (isTaskConversation) {
    panelTitle =
      activeScheduledTask.taskState === ActiveScheduledTaskDetailState.Success
        ? activeScheduledTask.task?.displayName
        : activeScheduledTask.conversationTitle;
  }

  const handleAttachmentClick = useCallback(
    (attachment: DisplayAttachment) => {
      void openAttachmentCanvas(attachment).then((opened) => {
        if (opened) {
          handleClose();
        } else {
          downloadAttachment(attachment);
        }
      });
    },
    [openAttachmentCanvas, downloadAttachment, handleClose],
  );

  const handleSourceClick = useCallback(
    async (source: QuotationSource) => {
      const { url, title, contentType } = source;
      if (
        !isDialFileId(url) &&
        !isExternalSourcePreviewable(contentType, url)
      ) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      const resolvedContentType = resolveExternalSourceContentType(
        contentType,
        url,
      );
      const attachment: DisplayAttachment = {
        id: url,
        name: title,
        contentType: resolvedContentType,
        type: resolvedContentType.startsWith('image/')
          ? AttachmentType.Image
          : AttachmentType.File,
        status: RequestStatus.Idle,
        url,
      };
      const opened = await openAttachmentCanvas(attachment);
      if (opened) {
        handleClose();
        return;
      }
      if (!isDialFileId(url)) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        downloadAttachment(attachment);
      }
    },
    [openAttachmentCanvas, downloadAttachment, handleClose],
  );

  const downloadableAttachments = useMemo(
    () => [...uploaded, ...generated].filter(isDownloadableAttachment),
    [uploaded, generated],
  );

  const handleDownloadAll = useCallback(() => {
    downloadableAttachments.forEach((attachment, index) => {
      setTimeout(
        () => triggerAttachmentDownload(attachment, resolveDialFileDownloadUrl),
        index * DOWNLOAD_ALL_STAGGER_MS,
      );
    });
  }, [downloadableAttachments]);

  const isMobile = useIsMobile();
  const maxPanelWidth = usePanelMaxWidth(MIN_CONTENT_AREA_WIDTH);
  const [storedWidth, setStoredWidth] = useLocalStorage(
    StorageKey.ConversationSourcesWidth,
    DEFAULT_PANEL_WIDTH,
  );
  const defaultPanelWidth = Math.min(
    Math.max(storedWidth, MIN_PANEL_WIDTH),
    maxPanelWidth,
  );

  const labels = useMemo(
    () => ({
      ariaLabel: t(SidebarI18nKeys.AriaLabel),
      closeLabel: t(ButtonsI18nKeys.Close),
      searchPlaceholder: t(BasicI18nKeys.SearchPlaceholder),
      searchClearLabel: t(BasicI18nKeys.ClearSearch),
      noDataLabel: t(BasicI18nKeys.Empty),
      noResultsLabel: t(BasicI18nKeys.NoResults),
      downloadAllLabel: t(SidebarI18nKeys.DownloadAll),
      uploadedSectionTitle: t(SidebarI18nKeys.SectionUploadedFiles),
      generatedSectionTitle: t(SidebarI18nKeys.SectionGeneratedFiles),
      sourcesSectionTitle: t(SidebarI18nKeys.SectionSources),
      copySourceLabel: t(ButtonsI18nKeys.CopyLink),
      sourceCopiedLabel: t(ButtonsI18nKeys.Copied),
      attachmentClickLabel: t(AttachmentsI18nKeys.Download),
    }),
    [t],
  );

  return (
    <ConversationSourcesPanel
      isOpen={isOpen}
      onClose={handleClose}
      uploaded={uploaded}
      generated={generated}
      sources={sources}
      onAttachmentClick={handleAttachmentClick}
      onSourceClick={handleSourceClick}
      onDownloadAll={
        downloadableAttachments.length > 0 ? handleDownloadAll : undefined
      }
      isMobile={isMobile}
      defaultWidth={defaultPanelWidth}
      minWidth={MIN_PANEL_WIDTH}
      maxWidth={maxPanelWidth}
      onResizeStop={setStoredWidth}
      labels={labels}
      title={panelTitle}
      additionalSections={additionalSections}
    />
  );
};

export default memo(ConversationSourcesPanelContainer);
