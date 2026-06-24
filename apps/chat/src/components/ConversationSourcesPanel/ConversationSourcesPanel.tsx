import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { ConversationSourcesPanel } from '@epam/ai-dial-source-panel';
import { memo, useCallback, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AttachmentsI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  SidebarI18nKeys,
} from '../../constants/translation-keys';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';
import { useAttachmentAction } from '../../hooks/attachment/useAttachmentAction';
import { useOpenAttachmentCanvas } from '../../hooks/attachment/useOpenAttachmentCanvas';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useConversationSources } from '../../hooks/conversation-sources/useConversationSources';
import useViewportWidth from '../../hooks/use-viewport-width';
import useLocalStorage from '../../hooks/useLocalStorage';
import { StorageKey } from '../../types/storage-key';

const MIN_PANEL_WIDTH = 312;
const DEFAULT_PANEL_WIDTH = 360;

const ConversationSourcesPanelContainer: FC = () => {
  const { t } = useTranslation();
  const { handleClose, isOpen, messages } = useSourcesSidebar();
  const { uploaded, generated, sources } = useConversationSources(messages);
  const { handleAttachmentClick: downloadAttachment } = useAttachmentAction();
  const { openAttachmentCanvas } = useOpenAttachmentCanvas();

  const handleAttachmentClick = useCallback(
    (attachment: DisplayAttachment) => {
      void openAttachmentCanvas(attachment).then((opened) => {
        if (!opened) downloadAttachment(attachment);
      });
    },
    [openAttachmentCanvas, downloadAttachment],
  );

  const isMobile = useIsMobile();
  const viewportWidth = useViewportWidth();
  const maxPanelWidth = Math.floor(viewportWidth * 0.5);
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
      emptyLabel: t(BasicI18nKeys.Empty),
      noResultsLabel: t(BasicI18nKeys.NoResults),
      downloadAllLabel: t(SidebarI18nKeys.DownloadAll),
      uploadedSectionTitle: t(SidebarI18nKeys.SectionUploadedFiles),
      generatedSectionTitle: t(SidebarI18nKeys.SectionGeneratedFiles),
      sourcesSectionTitle: t(SidebarI18nKeys.SectionSources),
      copySourceLabel: t(SidebarI18nKeys.CopySource),
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
