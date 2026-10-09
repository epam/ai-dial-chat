import { useOpenAttachmentCanvas } from '@epam/ai-dial-attachment-canvas';
import {
  useAttachmentAction,
  isDownloadableAttachment,
  downloadAttachment as triggerAttachmentDownload,
} from '@epam/ai-dial-chat-hooks/attachments';
import { useConversationSources } from '@epam/ai-dial-chat-hooks/conversation-sources';
import {
  isDialFileId,
  isExternalSourcePreviewable,
  resolveExternalSourceContentType,
} from '@epam/ai-dial-chat-hooks/file-manager';
import { usePanelMaxWidth } from '@epam/ai-dial-chat-hooks/viewport-layout';
import type {
  AttachmentDisplayResolvers,
  DisplayAttachment,
  Message,
} from '@epam/ai-dial-chat-shared';
import {
  AttachmentType,
  MIMEType,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import { parsePdfPageReference } from '@epam/ai-dial-quotations';
import { ConversationSourcesPanel } from '@epam/ai-dial-source-panel';
import type {
  ConversationSourcesPanelStyles,
  QuotationSource,
} from '@epam/ai-dial-source-panel';
import { memo, useCallback, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { MIN_CONTENT_AREA_WIDTH } from '../../constants/layout';
import {
  AttachmentsI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
  SidebarI18nKeys,
} from '../../constants/translation-keys';
import { useActiveScheduledTask } from '../../context/ActiveScheduledTaskContext';
import {
  useSourcesSidebar,
  useSourcesSidebarData,
} from '../../context/SourcesSidebarContext';
import { useAttachmentCanvasResolvers } from '../../hooks/attachment/useAttachmentCanvasResolvers';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useCloseSourcesSidebarOnSubjectChange } from '../../hooks/sources-sidebar/useCloseSourcesSidebarOnSubjectChange';
import useLocalStorage from '../../hooks/useLocalStorage';
import {
  ActiveScheduledTaskDetailState,
  ActiveScheduledTaskStatus,
} from '../../types/active-scheduled-task';
import { StorageKey } from '../../types/storage-key';
import { resolveDialFileDownloadUrl } from '../../utils/dial-file';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import TaskDetailsSection from './TaskDetailsSection/TaskDetailsSection';
import TaskHistorySection from './TaskHistorySection/TaskHistorySection';

/* Stable stand-in for the messages while the panel is closed. */
const EMPTY_MESSAGES: Message[] = [];

const MIN_PANEL_WIDTH = 312;
const DEFAULT_PANEL_WIDTH = 360;
/** Delay between successive triggered downloads so browsers don't block a burst of anchor clicks. */
const DOWNLOAD_ALL_STAGGER_MS = 150;

/* Stable references so useConversationSources'/useAttachmentAction's memoization isn't defeated by a new object/function each render. */
const attachmentDisplayResolvers: AttachmentDisplayResolvers = {
  resolvePreviewUrl: (dto) => resolveCatalogIconUrl(dto.url),
  resolvePlayUrl: (dto) => dto.url && resolveDialFileDownloadUrl(dto.url),
};

/*
 * Panel-wide style overrides, module-level so the memoized lib panel isn't
 * defeated by a new object each render: section headings sit on the small
 * semibold scale, and `sectionClassName` lines the files/sources sections up
 * with the task accordions, which add the kit's own px-4 on top of the body
 * padding.
 */
const panelStyles: ConversationSourcesPanelStyles = {
  typography: {
    sectionTitleClassName: 'dial-tiny-semi-text',
  },
  sectionClassName: 'px-4',
};

const ConversationSourcesPanelContainer: FC = () => {
  const { t } = useTranslation();
  const { handleClose, isOpen } = useSourcesSidebar();
  const { messages } = useSourcesSidebarData();
  /*
   * The panel mounts on every `/conversations/*` route even while closed, so
   * this is the one mount point where the sidebar's reset rule runs wherever
   * the sidebar can be open (the reset keys on the sidebar's subject, not the
   * route param — see the hook's JSDoc).
   */
  useCloseSourcesSidebarOnSubjectChange();
  const { uploaded, generated, sources } = useConversationSources(
    isOpen ? messages : EMPTY_MESSAGES,
    attachmentDisplayResolvers,
  );
  const { handleAttachmentClick: downloadAttachment } = useAttachmentAction({
    resolveDownloadUrl: resolveDialFileDownloadUrl,
  });
  const { resolvers, options } = useAttachmentCanvasResolvers();
  const { openAttachmentCanvas } = useOpenAttachmentCanvas(resolvers, options);
  const activeScheduledTask = useActiveScheduledTask();
  const isTaskConversation =
    activeScheduledTask.status === ActiveScheduledTaskStatus.TaskConversation;

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

  /*
   * Each section component owns its accordion state and presentation logic;
   * the container is the single context consumer and passes each section its
   * data slice.
   */
  const additionalSections = isTaskConversation ? (
    <>
      <TaskHistorySection
        history={activeScheduledTask.history}
        currentRunId={activeScheduledTask.runId}
        scheduleId={activeScheduledTask.scheduleId}
      />
      <TaskDetailsSection
        task={activeScheduledTask.task}
        taskState={activeScheduledTask.taskState}
        onRetry={activeScheduledTask.retryTask}
        scheduleId={activeScheduledTask.scheduleId}
      />
    </>
  ) : undefined;

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
      /* A `…pdf#page=N` source goes through the canvas's reference-PDF
       * resolver (it only runs for `referenceUrl` with no `url`), which keeps the
       * page; the generic PDF path strips the fragment and opens page 1. */
      const pageReference = parsePdfPageReference(url);
      if (pageReference?.page != null) {
        const pageAttachment: DisplayAttachment = {
          id: url,
          name: title,
          contentType: MIMEType.PDF,
          type: AttachmentType.File,
          status: RequestStatus.Idle,
          referenceUrl: url,
        };
        if (await openAttachmentCanvas(pageAttachment)) {
          handleClose();
          return;
        }
        if (isDialFileId(pageReference.baseUrl)) {
          downloadAttachment({
            ...pageAttachment,
            referenceUrl: undefined,
            url: pageReference.baseUrl,
          });
        } else {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
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
      codeBlockCopyLabel: t(ButtonsI18nKeys.Copy),
      codeBlockCopiedLabel: t(ButtonsI18nKeys.Copied),
      codeBlockDownloadLabel: t(ButtonsI18nKeys.Download),
      tableScrollRegionAriaLabel: t(ChatI18nKeys.ScrollableTable),
      mathScrollRegionAriaLabel: t(ChatI18nKeys.ScrollableFormula),
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
      styles={panelStyles}
    />
  );
};

export default memo(ConversationSourcesPanelContainer);
