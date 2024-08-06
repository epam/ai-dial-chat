/* eslint-disable @next/next/no-img-element */
import {
  IconCaretDownFilled,
  IconDownload,
  IconFile,
  IconFolder,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PlotParams } from 'react-plotly.js';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getMappedAttachmentUrl } from '@/src/utils/app/attachments';

import { Attachment } from '@/src/types/chat';
import { ImageMIMEType, MIMEType } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { PLOTLY_CONTENT_TYPE, stopBubbling } from '@/src/constants/chat';
import { FOLDER_ATTACHMENT_CONTENT_TYPE } from '@/src/constants/folders';

import { ImageAttachmentRenderer } from '@/src/components/Chat/ImageAttachmentRenderer';
import { Spinner } from '@/src/components/Common/Spinner';
import { PlotlyComponent } from '@/src/components/Plotly/Plotly';

import Link from '../../../public/images/icons/arrow-up-right-from-square.svg';
import Tooltip from '../Common/Tooltip';
import ChatMDComponent from '../Markdown/ChatMDComponent';
import { VisualizerRenderer } from '../VisualalizerRenderer/VisualizerRenderer';

import { PromptIcon } from '@/src/icons/PromptIcon';
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
  if (attachment.type === PLOTLY_CONTENT_TYPE) {
    return (
      <PlotlyComponent plotlyData={attachment.data as unknown as PlotParams} />
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

interface ChartAttachmentUrlRendererProps {
  attachmentUrl: string | undefined;
}

const ChartAttachmentUrlRenderer = ({
  attachmentUrl,
}: ChartAttachmentUrlRendererProps) => {
  const dispatch = useAppDispatch();

  const loadedCharts = useAppSelector(
    ConversationsSelectors.selectLoadedCharts,
  );
  const chartLoading = useAppSelector(
    ConversationsSelectors.selectChartLoading,
  );

  const chart = attachmentUrl
    ? loadedCharts.find((loadedChart) =>
        loadedChart.url.endsWith(attachmentUrl),
      )?.data
    : undefined;

  useEffect(() => {
    if (attachmentUrl && !chart) {
      dispatch(
        ConversationsActions.getChartAttachment({
          pathToChart: attachmentUrl,
        }),
      );
    }
  }, [attachmentUrl, chart, dispatch]);

  if (!attachmentUrl) {
    return null;
  }

  if (chartLoading) {
    return <Spinner className="mx-auto" size={30} />;
  }

  if (chart) {
    return <PlotlyComponent plotlyData={chart} />;
  }

  return null;
};

interface Props {
  attachment: Attachment;
  isInner?: boolean;
  isShowImageImmediate?: boolean;
}

interface AttachmentUrlRendererComponentProps {
  mappedAttachmentUrl: string;
  attachmentType: string;
}

const AttachmentUrlRendererComponent = ({
  mappedAttachmentUrl,
  attachmentType,
}: AttachmentUrlRendererComponentProps) => {
  const mappedVisualizers = useAppSelector(
    SettingsSelectors.selectMappedVisualizers,
  );

  const isCustomAttachmentType = useAppSelector((state) =>
    SettingsSelectors.selectIsCustomAttachmentType(state, attachmentType),
  );

  if (mappedVisualizers && isCustomAttachmentType) {
    return (
      <VisualizerRenderer
        attachmentUrl={mappedAttachmentUrl}
        renderer={mappedVisualizers[attachmentType][0]}
        mimeType={attachmentType}
      />
    );
  }

  if (attachmentType === PLOTLY_CONTENT_TYPE) {
    return <ChartAttachmentUrlRenderer attachmentUrl={mappedAttachmentUrl} />;
  }

  return (
    <AttachmentUrlRenderer
      attachmentUrl={mappedAttachmentUrl}
      attachmentType={attachmentType}
    />
  );
};

export const MessageAttachment = ({
  attachment,
  isInner,
  isShowImageImmediate,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const [isOpened, setIsOpened] = useState(false);
  const [wasOpened, setWasOpened] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const isCustomAttachmentType = useAppSelector((state) =>
    SettingsSelectors.selectIsCustomAttachmentType(state, attachment.type),
  );

  useEffect(() => {
    const handleResize = () => {
      if (wasOpened && anchorRef.current) {
        const anchor = anchorRef.current;
        const styles = getComputedStyle(anchorRef.current);
        const padding =
          parseFloat(styles.paddingBottom || '0') +
          parseFloat(styles.paddingTop || '0');
        if (anchor.clientHeight - padding > 0) {
          anchorRef.current?.scrollIntoView({ block: 'end' });
          setWasOpened(false);
        }
      }
    };
    const resizeObserver = new ResizeObserver(handleResize);

    if (anchorRef.current) {
      resizeObserver.observe(anchorRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [wasOpened]);

  const isFolder = attachment.type === FOLDER_ATTACHMENT_CONTENT_TYPE;
  const Icon = isFolder ? IconFolder : attachment.type ? IconFile : PromptIcon;

  const isOpenable =
    attachment.data ||
    (attachment.url && imageTypes.has(attachment.type)) ||
    attachment.type === PLOTLY_CONTENT_TYPE ||
    isCustomAttachmentType;
  const mappedAttachmentUrl = useMemo(
    () => getMappedAttachmentUrl(attachment.url),
    [attachment.url],
  );
  const mappedAttachmentReferenceUrl = useMemo(
    () => getMappedAttachmentUrl(attachment.reference_url),
    [attachment.reference_url],
  );

  if (
    (attachment.type === 'image/png' || attachment.type === 'image/jpeg') &&
    isShowImageImmediate
  ) {
    return <ImageAttachmentRenderer attachment={attachment} />;
  }

  return (
    <div
      data-no-context-menu
      className={classNames(
        'border border-secondary bg-layer-2 px-1 py-2 shadow-primary hover:border-accent-quaternary',
        isExpanded
          ? 'col-span-1 col-start-1 rounded-primary sm:col-span-2 md:col-span-3'
          : 'rounded-full hover:bg-accent-secondary-alpha',
        !isInner && 'border border-secondary',
        isShowImageImmediate && !isExpanded && 'max-w-[180px]',
      )}
    >
      <div className="flex items-center gap-2 px-2">
        <div className="flex items-center">
          {mappedAttachmentReferenceUrl ? (
            <Tooltip tooltip="Open link">
              <a
                href={mappedAttachmentReferenceUrl}
                target="_blank"
                className="shrink-0"
                rel="noopener noreferrer"
              >
                <Link
                  height={18}
                  width={18}
                  className="text-tertiary-bg-light hover:text-primary-bg-light"
                />
              </a>
            </Tooltip>
          ) : (
            <Icon size={18} className="shrink-0 text-primary-bg-light" />
          )}
        </div>
        <button
          onClick={() => {
            setIsExpanded((isExpanded) => !isExpanded);
            if (isOpenable) {
              setIsOpened((isOpened) => {
                if (!isOpened) {
                  setWasOpened(true);
                }
                return !isOpened;
              });
            }
          }}
          className="flex grow items-center justify-between overflow-hidden"
          data-qa={isExpanded ? 'attachment-expanded' : 'attachment-collapsed'}
        >
          <span
            className={classNames(
              'shrink truncate whitespace-pre text-left text-sm font-medium text-primary-bg-light',
              isExpanded || isFolder || mappedAttachmentReferenceUrl
                ? 'max-w-full'
                : 'max-w-[calc(100%-20px)]',
            )}
            title={
              attachment.title ||
              attachment.url ||
              t('chat.common.button.attachment.label') ||
              ''
            }
          >
            {attachment.title ||
              attachment.url ||
              t('chat.common.button.attachment.label')}
          </span>
          {isOpenable && !isFolder ? (
            <div className="flex gap-2">
              {imageTypes.has(attachment.type) && (
                <a
                  download={attachment.title}
                  href={mappedAttachmentUrl}
                  onClick={stopBubbling}
                  className="text-tertiary-bg-light hover:text-primary-bg-light"
                >
                  <IconDownload size={18} />
                </a>
              )}
              <IconCaretDownFilled
                className={classNames(
                  'shrink-0 text-quaternary-bg-light transition',
                  isOpened && 'rotate-180',
                )}
                size={12}
              />
            </div>
          ) : (
            !isFolder &&
            !mappedAttachmentReferenceUrl && (
              <a
                download={attachment.title}
                href={mappedAttachmentUrl}
                onClick={stopBubbling}
                target="_blank"
                className="text-tertiary-bg-light hover:text-primary-bg-light"
              >
                <IconDownload size={18} />
              </a>
            )
          )}
        </button>
      </div>
      {isOpenable && isOpened && (
        <div
          className="relative h-auto w-full overflow-hidden p-3 text-sm duration-200"
          ref={anchorRef}
        >
          {attachment.data && (
            <AttachmentDataRenderer attachment={attachment} isInner={isInner} />
          )}
          {mappedAttachmentUrl && (
            <AttachmentUrlRendererComponent
              attachmentType={attachment.type}
              mappedAttachmentUrl={mappedAttachmentUrl}
            />
          )}
          {mappedAttachmentReferenceUrl && (
            <a
              href={mappedAttachmentReferenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block text-pr-primary-700"
            >
              {t('chat.common.link.reference.label')}
            </a>
          )}
        </div>
      )}
    </div>
  );
};
