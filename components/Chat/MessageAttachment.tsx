import {
  IconChevronDown,
  IconExternalLink,
  IconPaperclip,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import Image from 'next/image';

import { Attachment, AttachmentMIMEType } from '@/types/chat';

import ChatMDComponent from '../Markdown/ChatMDComponent';

interface Props {
  attachment: Attachment;
}

export const MessageAttachment = ({ attachment }: Props) => {
  const { t } = useTranslation('chat');
  const [isOpened, setIsOpened] = useState(false);
  const imageTypes: AttachmentMIMEType[] = ['image/jpeg', 'image/png'];

  return (
    <div
      className={`px-1 py-2 border rounded-lg dark:bg-gray-2 dark:border-gray-900/50 ${
        isOpened ? 'w-full' : 'w-[30%]'
      }`}
    >
      <div className={`px-2 flex items-center gap-3`}>
        <div className="flex items-center">
          {attachment.reference_url ? (
            <a
              href={attachment.reference_url}
              target="_blank"
              className="flex-shrink-0"
            >
              <IconExternalLink size={18} />
            </a>
          ) : (
            <IconPaperclip size={18} className="flex-shrink-0" />
          )}
        </div>
        <button
          onClick={() => {
            setIsOpened((isOpened) => !isOpened);
          }}
          className="flex grow items-center justify-between gap-1"
        >
          <span
            className={`font-semibold ${
              isOpened
                ? 'max-w-full'
                : 'text-ellipsis overflow-hidden whitespace-nowrap max-w-[90px]'
            }`}
            title={attachment.title}
          >
            {attachment.title}
          </span>
          <IconChevronDown
            className={`transition ${isOpened ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      {(attachment.data || attachment.url) && (
        <div
          className={`relative overflow-hidden text-sm ${
            isOpened ? 'h-full w-full mt-2 pt-4 transition-all' : 'h-0'
          }`}
        >
          {imageTypes.includes(attachment.type) && attachment.url ? (
            <Image src={attachment.url} fill={true} alt="Attachment image" />
          ) : attachment.type === 'text/plain' ? (
            <div className="overflow-hidden max-w-full">
              <span className="whitespace-pre-wrap">{attachment.data}</span>
            </div>
          ) : (
            (attachment.type === 'text/markdown' || !attachment.type) &&
            attachment.data && (
              <ChatMDComponent
                isShowResponseLoader={false}
                content={attachment.data}
              />
            )
          )}

          {attachment.reference_url && (
            <a
              href={attachment.reference_url}
              target="_blank"
              className="block mt-3"
            >
              {t('Reference')}
            </a>
          )}
        </div>
      )}
    </div>
  );
};
