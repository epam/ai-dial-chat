/* eslint-disable @next/next/no-img-element */
import { IconDownload, IconFile, IconFolder } from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getMappedAttachmentUrl } from '@/src/utils/app/attachments';

import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  SettingsSelectors,
} from '@/src/store/selectors';

import {
  AUDIO_TYPES_SET,
  IMAGE_TYPES_SET,
  PLOTLY_CONTENT_TYPE,
  VIDEO_TYPES_SET,
  stopBubbling,
} from '@/src/constants/chat';
import { FOLDER_ATTACHMENT_CONTENT_TYPE } from '@/src/constants/folders';

import { withErrorBoundary } from '@/src/components/Common/ErrorBoundary';
import { Spinner } from '@/src/components/Common/Spinner';
import { Tooltip } from '@/src/components/Common/Tooltip';
import { ChatMDComponent } from '@/src/components/Markdown/ChatMDComponent';
import { PlotlyComponent } from '@/src/components/Plotly/Plotly';
import { PlotlyStringDataRenderer } from '@/src/components/Plotly/PlotlyStringDataRenderer';
import { VisualizerRenderer } from '@/src/components/VisualalizerRenderer/VisualizerRenderer';

import LinkIcon from '@/public/images/icons/arrow-up-right-from-square.svg';
import ChevronDown from '@/public/images/icons/chevron-down.svg';
import { Attachment, MIMEType } from '@epam/ai-dial-shared';
import { sanitize } from 'isomorphic-dompurify';

interface AttachmentDataRendererProps {
  attachment: Attachment;
  isInner?: boolean;
}

const getSourceDataUrl = (attachment: Attachment): string | undefined => {
  if (attachment.url) {
    return getMappedAttachmentUrl(attachment.url);
  }
  if (attachment.data) {
    return `data:${attachment.type};base64,${attachment.data}`;
  }
};

const AttachmentSourceRenderer = ({
  attachment,
}: AttachmentDataRendererProps) => {
  return <source src={getSourceDataUrl(attachment)} type={attachment.type} />;
};

const AttachmentDataRenderer = ({
  attachment,
  isInner,
}: AttachmentDataRendererProps) => {
  if (AUDIO_TYPES_SET.has(attachment.type)) {
    return (
      <audio controls>
        <AttachmentSourceRenderer attachment={attachment} />
      </audio>
    );
  }
  if (VIDEO_TYPES_SET.has(attachment.type)) {
    return (
      <video width="100%" controls>
        <AttachmentSourceRenderer attachment={attachment} />
      </video>
    );
  }

  if (IMAGE_TYPES_SET.has(attachment.type)) {
    return (
      <img
        src={getSourceDataUrl(attachment)}
        className="m-0 aspect-auto w-full"
        alt="Attachment image"
      />
    );
  }

  if (!attachment.data) {
    return null;
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
    return <PlotlyStringDataRenderer plotlyStringData={attachment.data} />;
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
}

const AttachmentRendererComponent = withErrorBoundary(
  ({ attachment, isInner }: AttachmentDataRendererProps) => {
    const attachmentType: MIMEType = attachment.type;
    const mappedAttachmentUrl = useMemo(
      () => getSourceDataUrl(attachment),
      [attachment],
    );
    const mappedVisualizers = useAppSelector(
      SettingsSelectors.selectMappedVisualizers,
    );
    const selectIsCustomAttachmentTypeSelector = useMemo(
      () => SettingsSelectors.selectIsCustomAttachmentType(attachmentType),
      [attachmentType],
    );
    const isCustomAttachmentType = useAppSelector(
      selectIsCustomAttachmentTypeSelector,
    );

    if (
      mappedVisualizers &&
      isCustomAttachmentType &&
      attachment.url &&
      mappedAttachmentUrl
    ) {
      return (
        <VisualizerRenderer
          attachmentUrl={mappedAttachmentUrl}
          renderer={mappedVisualizers[attachmentType][0]}
          mimeType={attachmentType}
        />
      );
    }

    if (
      attachmentType === PLOTLY_CONTENT_TYPE &&
      attachment.url &&
      mappedAttachmentUrl
    ) {
      return <ChartAttachmentUrlRenderer attachmentUrl={mappedAttachmentUrl} />;
    }

    return <AttachmentDataRenderer attachment={attachment} isInner={isInner} />;
  },
);

export const MessageAttachment = ({ attachment, isInner }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const [isOpened, setIsOpened] = useState(false);
  const [wasOpened, setWasOpened] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const anchorRef = useRef<HTMLDivElement>(null);

  const selectIsCustomAttachmentTypeSelector = useMemo(
    () => SettingsSelectors.selectIsCustomAttachmentType(attachment.type),
    [attachment.type],
  );
  const isCustomAttachmentType = useAppSelector(
    selectIsCustomAttachmentTypeSelector,
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
  const Icon = isFolder ? IconFolder : IconFile;

  const isOpenable =
    attachment.data ||
    (attachment.url && IMAGE_TYPES_SET.has(attachment.type)) ||
    attachment.type === PLOTLY_CONTENT_TYPE ||
    (attachment.url && VIDEO_TYPES_SET.has(attachment.type)) ||
    (attachment.url && AUDIO_TYPES_SET.has(attachment.type)) ||
    isCustomAttachmentType;
  const mappedAttachmentUrl = useMemo(
    () => getSourceDataUrl(attachment),
    [attachment],
  );
  const mappedAttachmentReferenceUrl = useMemo(
    () => getMappedAttachmentUrl(attachment.reference_url),
    [attachment.reference_url],
  );

  const isDownloadable =
    IMAGE_TYPES_SET.has(attachment.type) ||
    VIDEO_TYPES_SET.has(attachment.type) ||
    AUDIO_TYPES_SET.has(attachment.type);

  return (
    <div
      data-no-context-menu
      className={classNames(
        'rounded bg-layer-3 px-1 py-2',
        isExpanded && 'col-span-1 col-start-1 sm:col-span-2 md:col-span-3',
        !isInner && 'border border-secondary',
        attachment.openFullScreen &&
          isOpened &&
          'fixed inset-x-0 top-0 z-40 flex h-full flex-col',
      )}
    >
      <div className="flex items-center gap-3 px-2">
        <div className="flex items-center">
          {mappedAttachmentReferenceUrl ? (
            <Tooltip tooltip="Open link">
              <a
                href={mappedAttachmentReferenceUrl}
                target="_blank"
                className="shrink-0"
                rel="noopener noreferrer"
              >
                <LinkIcon
                  height={18}
                  width={18}
                  className="text-secondary hover:text-accent-primary"
                />
              </a>
            </Tooltip>
          ) : (
            <Icon size={18} className="shrink-0 text-secondary" />
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
              'shrink truncate whitespace-pre text-left text-sm',
              isExpanded || isFolder || mappedAttachmentReferenceUrl
                ? 'max-w-full'
                : 'max-w-[calc(100%-30px)]',
            )}
            title={attachment.title || attachment.url || t('Attachment')}
          >
            {attachment.title || attachment.url || t('Attachment')}
          </span>
          {isOpenable && !isFolder ? (
            <div className="flex gap-2">
              {isDownloadable && (
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
            !isFolder &&
            !mappedAttachmentReferenceUrl && (
              <a
                download={attachment.title}
                href={mappedAttachmentUrl}
                onClick={stopBubbling}
                target="_blank"
                className="text-secondary hover:text-accent-primary"
              >
                <IconDownload size={18} />
              </a>
            )
          )}
        </button>
      </div>
      {isOpenable && isOpened && (
        <div
          className={classNames(
            'relative mt-2 w-full border-t border-tertiary p-3 pt-4 text-sm duration-200',
            attachment.openFullScreen
              ? 'grow overflow-auto'
              : 'h-auto overflow-hidden',
          )}
          ref={anchorRef}
        >
          <AttachmentRendererComponent
            attachment={attachment}
            isInner={isInner}
          />
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
