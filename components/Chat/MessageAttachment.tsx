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
      className={`px-1 py-2 border rounded-lg dark:bg-gray-2 dark:border-gray-900/50 ${
        isOpened ? 'col-start-1 col-span-1 sm:col-span-2 md:col-span-3' : ''
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
          className="flex grow items-center justify-between overflow-hidden"
        >
          <span
            className={`font-semibold text-sm text-left flex-shrink ${
              isOpened
                ? 'max-w-full'
                : 'max-w-[calc(100%-30px)] text-ellipsis overflow-hidden whitespace-nowrap'
            }`}
            title={attachment.title}
          >
            {attachment.title || t('Attachment')}
          </span>
          <IconChevronDown
            className={`flex-shrink-0 transition ${
              isOpened ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>
      {(attachment.data || attachment.url) && (
        <div
          className={`relative overflow-hidden text-sm w-full ${
            isOpened ? 'h-auto mt-2 pt-4 transition-all' : 'h-0'
          }`}
        >
          {imageTypes.includes(attachment.type) ? (
            <img
              src={
                attachment.url ||
                `data:${attachment.type};base64,${attachment.data}`
              }
              className="aspect-auto w-full m-0"
              alt="Attachment image"
            />
          ) : attachment.type === 'text/html' ? (
            <div className="max-w-full flex overflow-auto">
              <span
                className="shrink-0 whitespace-pre prose dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: sanitize(attachment.data || ''),
                }}
              ></span>
            </div>
          ) : attachment.type === 'text/plain' ? (
            <div className="overflow-hidden max-w-full">
              <span className="whitespace-pre-wrap prose dark:prose-invert">
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
