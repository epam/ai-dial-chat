import type { Message } from '@epam/ai-dial-chat-shared';
import { SidebarPanel, SidebarSide } from '@epam/ai-dial-sidebar';
import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import {
  IconDownload,
  IconFileDescription,
  IconSearch,
} from '@tabler/icons-react';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { SidebarI18nKeys } from '../../constants/translation-keys';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';
import { useConversationSources } from '../../hooks/conversation-sources/useConversationSources';
import FilesSection from './sections/FilesSection/FilesSection';
import SourcesSection from './sections/SourcesSection/SourcesSection';

interface Props {
  messages: Message[];
}

const ConversationSourcesPanel: FC<Props> = ({ messages }) => {
  const { t } = useTranslation();
  const { handleClose } = useSourcesSidebar();
  const { uploaded, generated } = useConversationSources(messages);
  const isEmpty = uploaded.length === 0 && generated.length === 0;

  return (
    <SidebarPanel
      side={SidebarSide.Right}
      ariaLabel={t(SidebarI18nKeys.AriaLabel)}
      closeLabel={t(SidebarI18nKeys.Close)}
      onClose={handleClose}
      leftActions={
        !isEmpty && (
          <DialGhostIconButton
            icon={<IconSearch size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
            aria-label={t(SidebarI18nKeys.Search)}
            disabled
          />
        )
      }
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
      {isEmpty ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-secondary">
          <IconFileDescription aria-hidden size={60} stroke={1} />
          <p className="dial-small-text text-center text-primary">
            {t(SidebarI18nKeys.Empty)}
          </p>
        </div>
      ) : (
        <>
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
        </>
      )}
    </SidebarPanel>
  );
};

export default memo(ConversationSourcesPanel);
