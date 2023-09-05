/* eslint-disable @next/next/no-img-element */
import { IconPaperclip } from '@tabler/icons-react';
import { useState } from 'react';

import { useTranslation } from 'next-i18next';

import { Attachment, AttachmentMIMEType } from '@/types/chat';

import Link from '../../public/images/icons/arrow-up-right-from-square.svg';
import ChevronDown from '../../public/images/icons/chevron-down.svg';
import ChatMDComponent from '../Markdown/ChatMDComponent';

import { sanitize } from 'isomorphic-dompurify';

interface Props {
  attachment: Attachment;
  isInner?: boolean;
}

export const MessageAttachment = ({ attachment, isInner }: Props) => {
  const { t } = useTranslation('chat');
  const [isOpened, setIsOpened] = useState(false);
  const imageTypes: AttachmentMIMEType[] = ['image/jpeg', 'image/png'];

  return (
    <div
      className={`rounded   px-1 py-2   ${
        isOpened ? 'col-span-1 col-start-1 sm:col-span-2 md:col-span-3' : ''
      } ${
        isInner
          ? 'bg-gray-100 dark:bg-gray-700'
          : 'border border-gray-400 bg-gray-300 dark:border-gray-700 dark:bg-gray-900'
      }`}
    >
      <div className={`flex items-center gap-3 px-2`}>
        <div className="flex items-center">
          {attachment.reference_url ? (
            <a
              href={attachment.reference_url}
              target="_blank"
              className="shrink-0"
              rel="noopener noreferrer"
            >
              <Link
                height={18}
                width={18}
                className="text-gray-500 hover:text-blue-500"
              />
            </a>
          ) : (
            <IconPaperclip
              size={18}
              className="shrink-0 text-gray-500 hover:text-blue-500"
            />
          )}
        </div>
        <button
          onClick={() => {
            setIsOpened((isOpened) => !isOpened);
          }}
          className="flex grow items-center justify-between overflow-hidden"
        >
          <span
            className={`shrink text-left text-sm ${
              isOpened ? 'max-w-full' : 'max-w-[calc(100%-30px)] truncate'
            }`}
            title={attachment.title}
          >
            {attachment.title || t('Attachment')}
          </span>
          <ChevronDown
            height={18}
            width={18}
            className={`shrink-0 text-gray-500 transition ${
              isOpened ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>
      {(attachment.data || attachment.url) && (
        <div
          className={`relative w-full overflow-hidden text-sm duration-200 ${
            isOpened ? 'mt-2 h-auto p-3 pt-4' : 'h-0'
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
                className="prose shrink-0 whitespace-pre text-sm dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: sanitize(attachment.data || ''),
                }}
              ></span>
            </div>
          ) : attachment.type === 'text/plain' ? (
            <div className="max-w-full overflow-hidden">
              <span className="prose whitespace-pre-wrap text-sm dark:prose-invert">
                {attachment.data}
              </span>
            </div>
          ) : (
            (attachment.type === 'text/markdown' || !attachment.type) &&
            attachment.data && (
              <ChatMDComponent
                isShowResponseLoader={false}
                content={attachment.data}
                isInner={isInner}
              />
            )
          )}

          {attachment.reference_url && (
            <a
              href={attachment.reference_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block text-blue-500"
            >
              {t('Reference...')}
            </a>
          )}
        </div>
      )}
    </div>
  );
};
