import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { ConversationSourcesPanel } from '@epam/ai-dial-source-panel';
import type { QuotationSource } from '@epam/ai-dial-source-panel';
import { memo, useCallback, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AttachmentsI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  SidebarI18nKeys,
} from '../../constants/translation-keys';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';
import {
  downloadAttachment as triggerAttachmentDownload,
  useAttachmentAction,
} from '../../hooks/attachment/useAttachmentAction';
import { useOpenAttachmentCanvas } from '../../hooks/attachment/useOpenAttachmentCanvas';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useConversationSources } from '../../hooks/conversation-sources/useConversationSources';
import useLocalStorage from '../../hooks/useLocalStorage';
import usePanelMaxWidth from '../../hooks/usePanelMaxWidth';
import { StorageKey } from '../../types/storage-key';
import { isDialFileId } from '../../utils/dial-file';

const MIN_PANEL_WIDTH = 312;
const DEFAULT_PANEL_WIDTH = 360;
/** Delay between successive triggered downloads so browsers don't block a burst of anchor clicks. */
const DOWNLOAD_ALL_STAGGER_MS = 150;

const isDownloadableAttachment = (attachment: DisplayAttachment): boolean =>
  attachment.url != null && isDialFileId(attachment.url);

const ConversationSourcesPanelContainer: FC = () => {
  const { t } = useTranslation();
  const { handleClose, isOpen, messages } = useSourcesSidebar();
  const { uploaded, generated, sources } = useConversationSources(messages);
  const { handleAttachmentClick: downloadAttachment } = useAttachmentAction();
  const { openAttachmentCanvas } = useOpenAttachmentCanvas();

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
      const attachment: DisplayAttachment = {
        id: url,
        name: title,
        contentType,
        type: contentType.startsWith('image/')
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
        () => triggerAttachmentDownload(attachment),
        index * DOWNLOAD_ALL_STAGGER_MS,
      );
    });
  }, [downloadableAttachments]);

  const isMobile = useIsMobile();
  const maxPanelWidth = usePanelMaxWidth();
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
      emptyLabel: t(BasicI18nKeys.Empty),
      noResultsLabel: t(BasicI18nKeys.NoResults),
      downloadAllLabel: t(SidebarI18nKeys.DownloadAll),
      uploadedSectionTitle: t(SidebarI18nKeys.SectionUploadedFiles),
      generatedSectionTitle: t(SidebarI18nKeys.SectionGeneratedFiles),
      sourcesSectionTitle: t(SidebarI18nKeys.SectionSources),
      copySourceLabel: t(ButtonsI18nKeys.CopyLink),
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
    />
  );
};

export default memo(ConversationSourcesPanelContainer);
