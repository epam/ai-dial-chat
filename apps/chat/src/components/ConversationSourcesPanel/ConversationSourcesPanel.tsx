import {
  PanelEmpty,
  PanelNoResults,
  SearchInput,
  SidebarPanel,
  SidebarOrientation,
} from '@epam/ai-dial-sidebar';
import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconDownload } from '@tabler/icons-react';
import { memo, useLayoutEffect, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AttachmentsI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  SidebarI18nKeys,
} from '../../constants/translation-keys';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';
import { useAttachmentAction } from '../../hooks/attachment/useAttachmentAction';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useConversationSources } from '../../hooks/conversation-sources/useConversationSources';
import useViewportWidth from '../../hooks/use-viewport-width';
import useLocalStorage from '../../hooks/useLocalStorage';
import { StorageKey } from '../../types/storage-key';
import { includesIgnoreCase } from '../../utils/string-utils';
import FilesSection from './sections/FilesSection/FilesSection';
import SourcesSection from './sections/SourcesSection/SourcesSection';

const MIN_PANEL_WIDTH = 312;
const DEFAULT_PANEL_WIDTH = 360;

// TODO: need add libs for this panel
const ConversationSourcesPanel: FC = () => {
  const { t } = useTranslation();
  const { handleClose, isOpen, messages } = useSourcesSidebar();
  const { uploaded, generated, sources } = useConversationSources(messages);
  const { handleAttachmentClick } = useAttachmentAction();
  const [searchQuery, setSearchQuery] = useState('');

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

  useLayoutEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredUploaded = useMemo(
    () =>
      searchQuery
        ? uploaded.filter((att) =>
            att.name.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : uploaded,
    [uploaded, searchQuery],
  );

  const filteredGenerated = useMemo(
    () =>
      searchQuery
        ? generated.filter((att) =>
            att.name.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : generated,
    [generated, searchQuery],
  );

  const filteredSources = useMemo(
    () =>
      searchQuery
        ? sources.filter(
            (s) =>
              includesIgnoreCase(s.title, searchQuery) ||
              includesIgnoreCase(s.url, searchQuery) ||
              (s.quote != null && includesIgnoreCase(s.quote, searchQuery)),
          )
        : sources,
    [sources, searchQuery],
  );

  const isEmpty =
    uploaded.length === 0 && generated.length === 0 && sources.length === 0;
  const isNoResults =
    searchQuery !== '' &&
    filteredUploaded.length === 0 &&
    filteredGenerated.length === 0 &&
    filteredSources.length === 0;

  return (
    <SidebarPanel
      isOpen={isOpen}
      orientation={SidebarOrientation.Right}
      className={isOpen ? 'mobile:w-full' : 'w-0'}
      styles={{
        bodyClassName: 'flex flex-col overflow-hidden p-0',
      }}
      ariaLabel={t(SidebarI18nKeys.AriaLabel)}
      closeLabel={t(ButtonsI18nKeys.Close)}
      onClose={handleClose}
      resizable={!isMobile}
      defaultWidth={defaultPanelWidth}
      minWidth={MIN_PANEL_WIDTH}
      maxWidth={maxPanelWidth}
      onResizeStop={setStoredWidth}
      rightActions={
        !isEmpty && (
          <DialGhostIconButton
            icon={<IconDownload size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
            aria-label={t(SidebarI18nKeys.DownloadAll)}
            disabled
          />
        )
      }
    >
      {!isEmpty && (
        <SearchInput
          placeholder={t(BasicI18nKeys.SearchPlaceholder)}
          value={searchQuery}
          onChange={setSearchQuery}
        />
      )}
      <div className="flex-1 overflow-y-auto p-4">
        {isEmpty ? (
          <PanelEmpty label={t(BasicI18nKeys.Empty)} />
        ) : isNoResults ? (
          <PanelNoResults label={t(BasicI18nKeys.NoResults)} />
        ) : (
          <>
            <FilesSection
              attachments={filteredUploaded}
              title={t(SidebarI18nKeys.SectionUploadedFiles)}
              onAttachmentClick={handleAttachmentClick}
              attachmentClickLabel={t(AttachmentsI18nKeys.Download)}
            />
            <FilesSection
              attachments={filteredGenerated}
              title={t(SidebarI18nKeys.SectionGeneratedFiles)}
              onAttachmentClick={handleAttachmentClick}
              attachmentClickLabel={t(AttachmentsI18nKeys.Download)}
            />
            <SourcesSection
              sources={filteredSources}
              title={t(SidebarI18nKeys.SectionSources)}
              copyLabel={t(SidebarI18nKeys.CopySource)}
            />
          </>
        )}
      </div>
    </SidebarPanel>
  );
};

export default memo(ConversationSourcesPanel);
