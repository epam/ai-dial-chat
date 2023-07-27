/* eslint-disable @next/next/no-img-element */
import {
  IconChevronDown,
  IconExternalLink,
  IconPaperclip,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Attachment, AttachmentMIMEType } from '@/types/chat';

import ChatMDComponent from '../Markdown/ChatMDComponent';

import { sanitize } from 'isomorphic-dompurify';

interface Props {
  attachment: Attachment;
}

export const MessageAttachment = ({ attachment }: Props) => {
  const { t } = useTranslation('chat');
  const [isOpened, setIsOpened] = useState(false);
  const imageTypes: AttachmentMIMEType[] = ['image/jpeg', 'image/png'];

  return (
    <div
      className={`dark:bg-gray-2 rounded-lg border px-1 py-2 dark:border-gray-900/50 ${
        isOpened ? 'col-span-1 col-start-1 sm:col-span-2 md:col-span-3' : ''
      }`}
    >
      <div className={`flex items-center gap-3 px-2`}>
        <div className="flex items-center">
          {attachment.reference_url ? (
            <a
              href={attachment.reference_url}
              target="_blank"
              className="shrink-0"
            >
              <IconExternalLink size={18} />
            </a>
          ) : (
            <IconPaperclip size={18} className="shrink-0" />
          )}
        </div>
        <button
          onClick={() => {
            setIsOpened((isOpened) => !isOpened);
          }}
          className="flex grow items-center justify-between overflow-hidden"
        >
          <span
            className={`shrink text-left text-sm font-semibold ${
              isOpened ? 'max-w-full' : 'max-w-[calc(100%-30px)] truncate'
            }`}
            title={attachment.title}
          >
            {attachment.title || t('Attachment')}
          </span>
          <IconChevronDown
            className={`shrink-0 transition ${isOpened ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      {(attachment.data || attachment.url) && (
        <div
          className={`relative w-full overflow-hidden text-sm ${
            isOpened ? 'mt-2 h-auto pt-4 transition-all' : 'h-0'
          }`}
        >
          {imageTypes.includes(attachment.type) ? (
            <img
              src={
                attachment.url ||
                `data:${attachment.type};base64,${attachment.data}`
              }
              className="m-0 aspect-auto w-full"
              alt="Attachment image"
            />
          ) : attachment.type === 'text/html' ? (
            <div className="flex max-w-full overflow-auto">
              <span
                className="prose shrink-0 whitespace-pre dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: sanitize(attachment.data || ''),
                }}
              ></span>
            </div>
          ) : attachment.type === 'text/plain' ? (
            <div className="max-w-full overflow-hidden">
              <span className="prose whitespace-pre-wrap dark:prose-invert">
                {attachment.data}
              </span>
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
              className="mt-3 block font-bold underline"
            >
              {t('Reference')}
            </a>
          )}
        </div>
      )}
    </div>
  );
};
