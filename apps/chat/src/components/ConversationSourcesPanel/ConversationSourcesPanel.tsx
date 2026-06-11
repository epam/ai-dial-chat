import {
  PanelEmpty,
  PanelEmptyState,
  PanelNoResults,
  SearchInput,
  SidebarPanel,
  SidebarSide,
} from '@epam/ai-dial-sidebar';
import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconDownload, IconFileDescription } from '@tabler/icons-react';
import { memo, useLayoutEffect, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { SidebarI18nKeys } from '../../constants/translation-keys';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';
import { useAttachmentAction } from '../../hooks/attachment/useAttachmentAction';
import { useConversationSources } from '../../hooks/conversation-sources/useConversationSources';
import FilesSection from './sections/FilesSection/FilesSection';

// TODO: need add libs for this panel
const ConversationSourcesPanel: FC = () => {
  const { t } = useTranslation();
  const { handleClose, isOpen, messages } = useSourcesSidebar();
  const { uploaded, generated } = useConversationSources(messages);
  const { handleAttachmentClick } = useAttachmentAction();
  const [searchQuery, setSearchQuery] = useState('');

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

  const isEmpty = uploaded.length === 0 && generated.length === 0;
  const isNoResults =
    searchQuery !== '' &&
    filteredUploaded.length === 0 &&
    filteredGenerated.length === 0;

  return (
    <SidebarPanel
      isOpen={isOpen}
      side={SidebarSide.Right}
      className={isOpen ? 'w-[360px] mobile:w-full' : 'w-0'}
      ariaLabel={t(SidebarI18nKeys.AriaLabel)}
      closeLabel={t(SidebarI18nKeys.Close)}
      onClose={handleClose}
      bodyClassName="flex flex-col overflow-hidden p-0"
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
          placeholder={t(SidebarI18nKeys.Search)}
          value={searchQuery}
          onChange={setSearchQuery}
        />
      )}
      <div className="flex-1 overflow-y-auto p-4">
        {isEmpty ? (
          <PanelEmpty label={t(SidebarI18nKeys.Empty)} />
        ) : isNoResults ? (
          <PanelNoResults label={t(SidebarI18nKeys.NoResults)} />
        ) : (
          <>
            <FilesSection
              attachments={filteredUploaded}
              title={t(SidebarI18nKeys.SectionUploadedFiles)}
              onAttachmentClick={handleAttachmentClick}
              attachmentClickLabel={t(SidebarI18nKeys.AttachmentDownloadLabel)}
            />
            <FilesSection
              attachments={filteredGenerated}
              title={t(SidebarI18nKeys.SectionGeneratedFiles)}
              onAttachmentClick={handleAttachmentClick}
              attachmentClickLabel={t(SidebarI18nKeys.AttachmentDownloadLabel)}
            />
            {/* TODO: restore after implementing sources extraction from assistant
            messages */}
            {/* <SourcesSection title={t(SidebarI18nKeys.SectionSources)} /> */}
          </>
        )}
      </div>
    </SidebarPanel>
  );
};

export default memo(ConversationSourcesPanel);
