import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { AttachmentCard } from '@epam/ai-dial-conversation-input';
import { memo, useCallback, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { SidebarI18nKeys } from '../../../../constants/translation-keys';
import { downloadAttachment } from '../../../../utils/download-attachment';

interface Props {
  attachments: DisplayAttachment[];
  title: string;
}

const FilesSection: FC<Props> = ({ attachments, title }) => {
  const { t } = useTranslation();

  const handleDownload = useCallback(
    (id: string) => {
      const att = attachments.find((a) => a.id === id);
      if (!att?.url) return;
      downloadAttachment(att.url, att.name ?? id);
    },
    [attachments],
  );

  if (attachments.length === 0) {
    return null;
  }

  return (
    <section className="mb-6">
      <h2 className="dial-body-semi-text mb-3">{title}</h2>
      <div role="list" className="grid grid-cols-3 gap-3">
        {attachments.map((att) => (
          <div key={att.id} role="listitem">
            <AttachmentCard
              attachment={att}
              className="w-full"
              onDownload={att.url ? handleDownload : undefined}
              downloadLabel={t(SidebarI18nKeys.DownloadFile)}
            />
          </div>
        ))}
      </div>
    </section>
  );
};

export default memo(FilesSection);
