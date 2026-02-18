/* eslint-disable @next/next/no-img-element */
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconDownload,
  IconFile,
  IconFolder,
} from '@tabler/icons-react';
import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';

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
import { ButtonAppearance, DialButton } from '@epam/ai-dial-ui-kit';
import { sanitize } from 'isomorphic-dompurify';

interface AttachmentDataRendererProps {
  attachment: Attachment;
  isFullScreen?: boolean;
  onFullScreenClick?: () => void;
  isInner?: boolean;
  forceDefaultView?: boolean;
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
  isFullScreen,
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
        className={classNames(
          'm-0',
          isFullScreen
            ? 'size-auto max-h-full max-w-full object-contain'
            : 'aspect-auto w-full',
        )}
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
    return (
      <PlotlyStringDataRenderer
        plotlyStringData={attachment.data}
        isFullScreen={isFullScreen}
      />
    );
  }

  return null;
};

interface ChartAttachmentUrlRendererProps {
  attachmentUrl: string | undefined;
  isFullScreen?: boolean;
}

const ChartAttachmentUrlRenderer = ({
  attachmentUrl,
  isFullScreen,
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
    return <PlotlyComponent plotlyData={chart} isFullScreen={isFullScreen} />;
  }

  return null;
};

interface Props {
  attachment: Attachment;
  isInner?: boolean;
  forceDefaultView?: boolean;
}

const AttachmentRendererComponent = withErrorBoundary(
  ({
    attachment,
    isInner,
    isFullScreen,
    onFullScreenClick,
    forceDefaultView,
  }: AttachmentDataRendererProps) => {
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

    if (mappedVisualizers && isCustomAttachmentType && mappedAttachmentUrl) {
      return (
        <VisualizerRenderer
          attachmentUrl={mappedAttachmentUrl}
          renderer={mappedVisualizers[attachmentType][0]}
          mimeType={attachmentType}
          isFullScreen={isFullScreen}
          onFullScreenClick={onFullScreenClick}
          forceDefaultView={forceDefaultView}
        />
      );
    }

    if (
      attachmentType === PLOTLY_CONTENT_TYPE &&
      attachment.url &&
      mappedAttachmentUrl
    ) {
      return (
        <ChartAttachmentUrlRenderer
          attachmentUrl={mappedAttachmentUrl}
          isFullScreen={isFullScreen}
        />
      );
    }

    return (
      <AttachmentDataRenderer
        attachment={attachment}
        isInner={isInner}
        isFullScreen={isFullScreen}
      />
    );
  },
);

export const MessageAttachment = ({
  attachment,
  isInner,
  forceDefaultView,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const anchorRef = useRef<HTMLDivElement>(null);

  const selectIsCustomAttachmentTypeSelector = useMemo(
    () => SettingsSelectors.selectIsCustomAttachmentType(attachment.type),
    [attachment.type],
  );
  const isCustomAttachmentType = useAppSelector(
    selectIsCustomAttachmentTypeSelector,
  );

  const { expandedTypes, borderlessTypes } = useAppSelector(
    SettingsSelectors.selectAttachmentsSettings,
  );

  const isBorderless =
    borderlessTypes.includes(attachment.type) && !forceDefaultView;
  const isExpandedByDefault =
    (isBorderless || expandedTypes.includes(attachment.type)) &&
    !forceDefaultView;

  const [isOpened, setIsOpened] = useState(isExpandedByDefault);
  const [wasOpened, setWasOpened] = useState(isExpandedByDefault);
  const [isExpanded, setIsExpanded] = useState(isExpandedByDefault);
  const [isFullScreen, setIsFullScreen] = useState(false);

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

  const isFullScreenEnabled =
    IMAGE_TYPES_SET.has(attachment.type) ||
    isCustomAttachmentType ||
    attachment.type === PLOTLY_CONTENT_TYPE;

  const FullScreenIcon = useMemo(
    () => (isFullScreen ? IconArrowsMinimize : IconArrowsMaximize),
    [isFullScreen],
  );

  const handleToggleFullScreen = (e?: MouseEvent<HTMLButtonElement>) => {
    if (e) {
      stopBubbling(e);
    }
    setIsFullScreen((prev) => {
      if (!prev) {
        setIsOpened(true);
        setIsExpanded(true);
      }
      return !prev;
    });
  };

  const handleDropdownClick = () => {
    if (isBorderless || isFullScreen) return;
    setIsExpanded((isExpanded) => !isExpanded);
    if (isOpenable) {
      setIsOpened((isOpened) => {
        if (!isOpened) {
          setWasOpened(true);
        }
        return !isOpened;
      });
    }
  };

  useEffect(() => {
    if (!isFullScreen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsFullScreen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isFullScreen]);

  return (
    <div
      data-no-context-menu
      className={classNames(
        'flex flex-col rounded',
        isExpanded && 'col-span-1 col-start-1 sm:col-span-2 md:col-span-3',
        !isInner && !isBorderless && 'border border-secondary',
        !isBorderless ? 'bg-layer-3 px-1 py-2' : 'mb-3 last:mb-0',
        isFullScreen && 'fixed left-0 top-0 z-[9999] size-full bg-layer-3',
        isFullScreen && isBorderless && '!bg-layer-1',
      )}
    >
      {isBorderless ? (
        <div
          className={classNames(
            'flex items-center justify-end gap-2',
            isFullScreen ? 'px-3 py-2' : 'p-1',
            isCustomAttachmentType && 'hidden',
          )}
        >
          {isDownloadable && !isFolder && (
            <a
              download={attachment.title}
              href={mappedAttachmentUrl}
              target="_blank"
              className="text-secondary hover:text-accent-primary"
            >
              <IconDownload size={18} />
            </a>
          )}

          {isFullScreenEnabled && (
            <DialButton
              className="text-secondary hover:text-accent-primary"
              iconBefore={<FullScreenIcon size={18} />}
              onClick={handleToggleFullScreen}
              appearance={ButtonAppearance.Link}
            />
          )}
        </div>
      ) : (
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
            onClick={handleDropdownClick}
            className="flex grow items-center justify-between overflow-hidden"
            data-qa={
              isExpanded ? 'attachment-expanded' : 'attachment-collapsed'
            }
          >
            <span
              className={classNames(
                'shrink truncate whitespace-pre pr-2 text-left text-sm',
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
                {isFullScreenEnabled && (
                  <DialButton
                    className="text-secondary hover:text-accent-primary"
                    iconBefore={<FullScreenIcon size={18} />}
                    onClick={handleToggleFullScreen}
                    appearance={ButtonAppearance.Link}
                  />
                )}
                {!isFullScreen && (
                  <ChevronDown
                    height={18}
                    width={18}
                    className={classNames(
                      'shrink-0 text-secondary transition',
                      isOpened && 'rotate-180',
                    )}
                  />
                )}
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
      )}

      {isOpenable && isOpened && (
        <div
          className={classNames(
            'relative overflow-hidden text-sm',
            isFullScreen
              ? 'm-0 flex grow items-center justify-center p-3'
              : 'h-auto w-full',
            !isBorderless && 'mt-2 border-t border-tertiary p-3 pt-4',
          )}
          ref={anchorRef}
        >
          <AttachmentRendererComponent
            attachment={attachment}
            isInner={isInner}
            isFullScreen={isFullScreen}
            onFullScreenClick={handleToggleFullScreen}
            forceDefaultView={forceDefaultView}
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
