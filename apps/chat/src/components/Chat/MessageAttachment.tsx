/* eslint-disable @next/next/no-img-element */
import { IconDownload, IconPaperclip } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

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
  'image/gif',
  'image/apng',
  'image/webp',
  'image/avif',
  'image/svg+xml',
  'image/bmp',
  'image/vnd.microsoft.icon',
  'image/x-icon',
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
          className="prose shrink-0 whitespace-pre text-sm"
          dangerouslySetInnerHTML={{
            __html: sanitize(attachment.data || ''),
          }}
        ></span>
      </div>
    );
  }
  if (attachment.type === 'text/plain') {
    return (
      <div className="max-w-full overflow-hidden">
        <span className="prose whitespace-pre-wrap text-sm">
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
      className={classNames(
        'rounded bg-layer-3 px-1 py-2',
        isExpanded && 'col-span-1 col-start-1 sm:col-span-2 md:col-span-3',
        !isInner && 'border border-secondary',
      )}
    >
      <div className="flex items-center gap-3 px-2">
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
                className="text-secondary hover:text-accent-primary"
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
            className={classNames(
              'shrink text-left text-sm',
              isExpanded ? 'max-w-full' : 'max-w-[calc(100%-30px)] truncate',
            )}
            title={attachment.title || attachment.url || t('Attachment') || ''}
          >
            {attachment.title || attachment.url || t('Attachment')}
          </span>
          {isOpenable ? (
            <div className="flex gap-2">
              {imageTypes.has(attachment.type) && (
                <a
                  download={attachment.title}
                  href={mappedAttachmentUrl}
                  onClick={stopBubbling}
                  className="text-secondary hover:text-accent-primary"
                >
                  <IconDownload size={18} />
                </a>
              )}
              <ChevronDown
                height={18}
                width={18}
                className={classNames(
                  'shrink-0 text-secondary transition',
                  isOpened && 'rotate-180',
                )}
              />
            </div>
          ) : (
            <a
              download={attachment.title}
              href={mappedAttachmentUrl}
              onClick={stopBubbling}
              target="_blank"
              className="text-secondary hover:text-accent-primary"
            >
              <IconDownload size={18} />
            </a>
          )}
        </button>
      </div>
      {isOpenable && isOpened && (
        <div className="relative mt-2 h-auto w-full overflow-hidden p-3 pt-4 text-sm duration-200">
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
              className="mt-3 block text-accent-primary"
            >
              {t('Reference...')}
            </a>
          )}
        </div>
      )}
    </div>
  );
};
