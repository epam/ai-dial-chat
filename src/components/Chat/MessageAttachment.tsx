/* eslint-disable @next/next/no-img-element */
import { IconDownload, IconPaperclip } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { getMappedAttachmentUrl } from '@/src/utils/app/attachments';

import { Attachment } from '@/src/types/chat';
import { ImageMIMEType, MIMEType } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { stopBubbling } from '@/src/constants/chat';

import Link from '../../../public/images/icons/arrow-up-right-from-square.svg';
import ChevronDown from '../../../public/images/icons/chevron-down.svg';
import ChatMDComponent from '../Markdown/ChatMDComponent';

import { sanitize } from 'isomorphic-dompurify';

const imageTypes: Set<ImageMIMEType> = new Set<ImageMIMEType>([
  'image/jpeg',
  'image/png',
]);

interface AttachmentDataRendererProps {
  attachment: Attachment;
  isInner?: boolean;
}

const AttachmentDataRenderer = ({
  attachment,
  isInner,
}: AttachmentDataRendererProps) => {
  if (!attachment.data) {
    return null;
  }

  if (imageTypes.has(attachment.type)) {
    return (
      <img
        src={`data:${attachment.type};base64,${attachment.data}`}
        className="m-0 aspect-auto w-full"
        alt="Attachment image"
      />
    );
  }

  if (attachment.type === 'text/html') {
    return (
      <div className="flex max-w-full overflow-auto">
        <span
          // TODO: dark prose-invert
          className="prose shrink-0 whitespace-pre text-sm dark:prose-invert"
          dangerouslySetInnerHTML={{
            __html: sanitize(attachment.data || ''),
          }}
        ></span>
      </div>
    );
  }
  if (attachment.type === 'text/plain') {
    return (
      // TODO: dark prose-invert
      <div className="max-w-full overflow-hidden">
        <span className="prose whitespace-pre-wrap text-sm dark:prose-invert">
          {attachment.data}
        </span>
      </div>
    );
  }
  if (attachment.type === 'text/markdown' || !attachment.type) {
    return (
      <ChatMDComponent
        isShowResponseLoader={false}
        content={attachment.data}
        isInner={isInner}
      />
    );
  }

  return null;
};

interface AttachmentUrlRendererProps {
  attachmentUrl: string | undefined;
  attachmentType: MIMEType;
}

const AttachmentUrlRenderer = ({
  attachmentUrl,
  attachmentType,
}: AttachmentUrlRendererProps) => {
  if (!attachmentUrl) {
    return null;
  }

  if (imageTypes.has(attachmentType)) {
    return (
      <img
        src={attachmentUrl}
        className="m-0 aspect-auto w-full"
        alt="Attachment image"
      />
    );
  }

  return null;
};

interface Props {
  attachment: Attachment;
  isInner?: boolean;
}

export const MessageAttachment = ({ attachment, isInner }: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const [isOpened, setIsOpened] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isOpenable =
    attachment.data || (attachment.url && imageTypes.has(attachment.type));
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
      } ${isInner ? 'bg-gray-100' : 'border-gray-400 bg-gray-300 border'}`}
    >
      <div className={`flex items-center gap-3 px-2`}>
        <div className="flex items-center">
          {mappedAttachmentReferenceUrl ? (
            <a
              href={mappedAttachmentReferenceUrl}
              target="_blank"
              className="shrink-0"
              rel="noopener noreferrer"
            >
              <Link
                height={18}
                width={18}
                className="hover:text-blue-500 text-secondary"
              />
            </a>
          ) : (
            <IconPaperclip size={18} className="shrink-0 text-secondary" />
          )}
        </div>
        <button
          onClick={() => {
            setIsExpanded((isExpanded) => !isExpanded);
            if (isOpenable) {
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
              className={`shrink-0 text-secondary transition ${
                isOpened ? 'rotate-180' : ''
              }`}
            />
          ) : (
            <a
              download={attachment.title}
              href={mappedAttachmentUrl}
              onClick={stopBubbling}
              className="hover:text-blue-500 text-secondary"
            >
              <IconDownload size={18} />
            </a>
          )}
        </button>
      </div>
      {isOpenable && isOpened && (
        <div
          className={`relative mt-2 h-auto w-full overflow-hidden p-3 pt-4 text-sm duration-200`}
        >
          {attachment.data && (
            <AttachmentDataRenderer attachment={attachment} isInner={isInner} />
          )}
          {mappedAttachmentUrl && (
            <AttachmentUrlRenderer
              attachmentUrl={mappedAttachmentUrl}
              attachmentType={attachment.type}
            />
          )}
          {mappedAttachmentReferenceUrl && (
            <a
              href={mappedAttachmentReferenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 mt-3 block"
            >
              {t('Reference...')}
            </a>
          )}
        </div>
      )}
    </div>
  );
};
