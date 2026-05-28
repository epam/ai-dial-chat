import type { Message } from '@epam/ai-dial-chat-shared';
import { SidebarPanel } from '@epam/ai-dial-sidebar';
import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconDownload, IconSearch } from '@tabler/icons-react';
import { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { SidebarI18nKeys } from '../../constants/translation-keys.js';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext.js';
import { useConversationSources } from '../../hooks/conversation-sources/useConversationSources.js';
import FilesSection from './sections/FilesSection/FilesSection.js';
import SourcesSection from './sections/SourcesSection/SourcesSection.js';

interface Props {
  messages: Message[];
  onSearch?: () => void;
  onDownloadAll?: () => void;
}

const ConversationSourcesPanel: FC<Props> = ({
  messages,
  onSearch,
  onDownloadAll,
}) => {
  const { t } = useTranslation();
  const { close } = useSourcesSidebar();
  const { uploaded, generated } = useConversationSources(messages);

  return (
    <SidebarPanel
      side="right"
      ariaLabel={t(SidebarI18nKeys.AriaLabel)}
      closeLabel={t(SidebarI18nKeys.Close)}
      onClose={close}
      leftActions={
        <DialGhostIconButton
          icon={<IconSearch size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
          aria-label={t(SidebarI18nKeys.Search)}
          disabled={!onSearch}
          tooltipProps={{
            tooltip: onSearch
              ? t(SidebarI18nKeys.Search)
              : t(SidebarI18nKeys.SearchDisabled),
          }}
          onClick={onSearch}
        />
      }
      rightActions={
        <DialGhostIconButton
          icon={<IconDownload size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
          aria-label={t(SidebarI18nKeys.DownloadAll)}
          disabled={!onDownloadAll}
          tooltipProps={{
            tooltip: onDownloadAll
              ? t(SidebarI18nKeys.DownloadAll)
              : t(SidebarI18nKeys.DownloadAllDisabled),
          }}
          onClick={onDownloadAll}
        />
      }
    >
      <FilesSection
        attachments={uploaded}
        title={t(SidebarI18nKeys.SectionUploadedFiles)}
        emptyMessage={t(SidebarI18nKeys.EmptyUploadedFiles)}
      />
      <FilesSection
        attachments={generated}
        title={t(SidebarI18nKeys.SectionGeneratedFiles)}
        emptyMessage={t(SidebarI18nKeys.EmptyGeneratedFiles)}
      />
      <SourcesSection
        title={t(SidebarI18nKeys.SectionSources)}
        emptyMessage={t(SidebarI18nKeys.EmptySources)}
      />
    </SidebarPanel>
  );
};

export default ConversationSourcesPanel;
