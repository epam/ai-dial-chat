/* eslint-disable @next/next/no-img-element */
import { IconDownload, IconPaperclip } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { getMappedAttachmentUrl } from '@/src/utils/app/attachments';

import { Attachment } from '@/src/types/chat';
import { ImageMIMEType } from '@/src/types/files';

import { stopBubbling } from '@/src/constants/chat';

import Link from '../../../public/images/icons/arrow-up-right-from-square.svg';
import ChevronDown from '../../../public/images/icons/chevron-down.svg';
import ChatMDComponent from '../Markdown/ChatMDComponent';

import { sanitize } from 'isomorphic-dompurify';

interface Props {
  attachment: Attachment;
  isInner?: boolean;
}
const imageTypes: Set<ImageMIMEType> = new Set<ImageMIMEType>([
  'image/jpeg',
  'image/png',
]);

export const MessageAttachment = ({ attachment, isInner }: Props) => {
  const { t } = useTranslation('chat');
  const [isOpened, setIsOpened] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isOpenable = !attachment.url;
  const mappedAttachmentUrl = useMemo(
    () => getMappedAttachmentUrl(attachment.url),
    [attachment.url],
  );
  const mappedAttachmentReferenceUrl = useMemo(
    () => getMappedAttachmentUrl(attachment.reference_url),
    [attachment.reference_url],
  );

  return (
    <div
      className={`rounded px-1 py-2 ${
        isExpanded ? 'col-span-1 col-start-1 sm:col-span-2 md:col-span-3' : ''
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
            <IconPaperclip size={18} className="shrink-0 text-gray-500" />
          )}
        </div>
        <button
          onClick={() => {
            setIsExpanded((isExpanded) => !isExpanded);
            if (!attachment.url) {
              setIsOpened((isOpened) => !isOpened);
            }
          }}
          className="flex grow items-center justify-between overflow-hidden"
        >
          <span
            className={`shrink text-left text-sm ${
              isExpanded ? 'max-w-full' : 'max-w-[calc(100%-30px)] truncate'
            }`}
            title={attachment.title}
          >
            {attachment.title || t('Attachment')}
          </span>
          {isOpenable ? (
            <ChevronDown
              height={18}
              width={18}
              className={`shrink-0 text-gray-500 transition ${
                isOpened ? 'rotate-180' : ''
              }`}
            />
          ) : (
            <a
              download={attachment.title}
              href={mappedAttachmentUrl}
              onClick={stopBubbling}
              className="text-gray-500 hover:text-blue-500"
            >
              <IconDownload size={18} />
            </a>
          )}
        </button>
      </div>
      {isOpenable && attachment.data && isOpened && (
        <div
          className={`relative mt-2 h-auto w-full overflow-hidden p-3 pt-4 text-sm duration-200`}
        >
          {imageTypes.has(attachment.type) ? (
            <img
              src={`data:${attachment.type};base64,${attachment.data}`}
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
              href={mappedAttachmentReferenceUrl}
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
