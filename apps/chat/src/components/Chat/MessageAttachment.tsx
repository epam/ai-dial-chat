/* eslint-disable @next/next/no-img-element */
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconDownload,
  IconFile,
  IconFolder,
} from '@tabler/icons-react';
import {
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';

import { useResizeObserver } from '@/src/hooks/useResizeObserver';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getMappedAttachmentUrl,
  hasPdfExtension,
  isDialApiFileUrl,
} from '@/src/utils/app/attachments';

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
  PDF_CONTENT_TYPE,
  PLOTLY_CONTENT_TYPE,
  VIDEO_TYPES_SET,
  stopBubbling,
} from '@/src/constants/chat';
import { FOLDER_ATTACHMENT_CONTENT_TYPE } from '@/src/constants/folders';
import { ChatI18nKeys, ErrorsI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { PdfPreviewModal } from '@/src/components/Chat/PdfAttachment/PdfPreviewModal';
import { withErrorBoundary } from '@/src/components/Common/ErrorBoundary';
import { ErrorMessage } from '@/src/components/Common/ErrorMessage';
import { Spinner } from '@/src/components/Common/Spinner';
import { Tooltip } from '@/src/components/Common/Tooltip';
import { ChatMDComponent } from '@/src/components/Markdown/ChatMDComponent';
import { PlotlyComponent } from '@/src/components/Plotly/Plotly';
import { PlotlyStringDataRenderer } from '@/src/components/Plotly/PlotlyStringDataRenderer';
import { VisualizerRenderer } from '@/src/components/VisualalizerRenderer/VisualizerRenderer';

import LinkIcon from '@/public/images/icons/arrow-up-right-from-square.svg';
import ChevronDown from '@/public/images/icons/chevron-down.svg';
import { Attachment, MIMEType } from '@epam/ai-dial-shared';
import { DialGhostIconButton, ElementSize } from '@epam/ai-dial-ui-kit';
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
  if (attachment.data?.trim()) {
    return `data:${attachment.type};base64,${attachment.data}`;
  }
};

const AttachmentSourceRenderer = ({
  attachment,
}: AttachmentDataRendererProps) => {
  return <source src={getSourceDataUrl(attachment)} type={attachment.type} />;
};

const ImageAttachmentRenderer = ({
  attachment,
  isFullScreen,
}: {
  attachment: Attachment;
  isFullScreen?: boolean;
}) => {
  const { t } = useTranslation(Translation.Chat);
  const [isImageValid, setIsImageValid] = useState(true);
  const imageUrl = getSourceDataUrl(attachment);
  if (!imageUrl) {
    return (
      <ErrorMessage error={t(ErrorsI18nKeys.ImageIsDeletedDoesNotExist)} />
    );
  }
  const onImageError = () => {
    setIsImageValid(false);
  };
  if (!isImageValid) {
    return (
      <ErrorMessage error={t(ErrorsI18nKeys.ImageIsDeletedDoesNotExist)} />
    );
  }
  return (
    <img
      src={imageUrl}
      className={classNames(
        'm-0',
        isFullScreen
          ? 'size-auto max-h-full max-w-full object-contain'
          : 'aspect-auto w-full',
      )}
      alt="Attachment image"
      onError={onImageError}
    />
  );
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
      <ImageAttachmentRenderer
        attachment={attachment}
        isFullScreen={isFullScreen}
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

const LinkIconComponent = () => (
  <LinkIcon
    height={DEFAULT_ICON_SIZES.SMALL}
    width={DEFAULT_ICON_SIZES.SMALL}
  />
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
  const [openPdfUrl, setOpenPdfUrl] = useState<string | null>(null);

  const handleResize = useCallback(() => {
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
  }, [wasOpened]);

  useResizeObserver(anchorRef.current, handleResize);

  const isFolder = attachment.type === FOLDER_ATTACHMENT_CONTENT_TYPE;
  const isPdfAttachment =
    !!attachment.url &&
    (attachment.type === PDF_CONTENT_TYPE || hasPdfExtension(attachment.url));
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

  const isPdfReference =
    !!mappedAttachmentReferenceUrl &&
    isDialApiFileUrl(mappedAttachmentReferenceUrl) &&
    (attachment.reference_type === PDF_CONTENT_TYPE ||
      hasPdfExtension(attachment.reference_url ?? ''));

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
    if (isPdfAttachment && mappedAttachmentUrl) {
      setOpenPdfUrl(mappedAttachmentUrl);
      return;
    }
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

  const handleClosePdfPreview = useCallback(() => {
    setOpenPdfUrl(null);
  }, []);

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
              className="link-icon-button-small"
            >
              <IconDownload size={DEFAULT_ICON_SIZES.SMALL} />
            </a>
          )}

          {isFullScreenEnabled && (
            <DialGhostIconButton
              size={ElementSize.Small}
              icon={<FullScreenIcon size={DEFAULT_ICON_SIZES.SMALL} />}
              onClick={handleToggleFullScreen}
            />
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 px-2">
          <div className="flex items-center">
            {mappedAttachmentReferenceUrl ? (
              <Tooltip
                tooltip={
                  isPdfReference
                    ? t(ChatI18nKeys.OpenPdf)
                    : t(ChatI18nKeys.OpenLink)
                }
              >
                {isPdfReference ? (
                  <button
                    type="button"
                    aria-label={t(ChatI18nKeys.OpenPdf)}
                    className="link-icon-button-small"
                    onClick={(e) => {
                      stopBubbling(e);
                      setOpenPdfUrl(mappedAttachmentReferenceUrl);
                    }}
                  >
                    <LinkIconComponent />
                  </button>
                ) : (
                  <a
                    href={mappedAttachmentReferenceUrl}
                    target="_blank"
                    className="link-icon-button-small"
                    rel="noopener noreferrer"
                  >
                    <LinkIconComponent />
                  </a>
                )}
              </Tooltip>
            ) : (
              <Icon
                size={DEFAULT_ICON_SIZES.SMALL}
                className="shrink-0 text-secondary"
              />
            )}
          </div>
          <div
            onClick={handleDropdownClick}
            className="flex grow cursor-pointer items-center justify-between overflow-hidden"
            data-qa={
              isExpanded ? 'attachment-expanded' : 'attachment-collapsed'
            }
          >
            <span
              className={classNames(
                'shrink truncate whitespace-pre pe-2 text-start text-sm',
                isExpanded || isFolder || mappedAttachmentReferenceUrl
                  ? 'max-w-full'
                  : 'max-w-[calc(100%-30px)]',
              )}
              title={
                attachment.title || attachment.url || t(ChatI18nKeys.Attachment)
              }
            >
              {attachment.title || attachment.url || t(ChatI18nKeys.Attachment)}
            </span>

            {isOpenable && !isFolder ? (
              <div className="flex gap-2">
                {isDownloadable && (
                  <a
                    download={attachment.title}
                    href={mappedAttachmentUrl}
                    onClick={stopBubbling}
                    className="link-icon-button-small"
                  >
                    <IconDownload size={DEFAULT_ICON_SIZES.SMALL} />
                  </a>
                )}
                {isFullScreenEnabled && isOpened && (
                  <DialGhostIconButton
                    size={ElementSize.Small}
                    icon={<FullScreenIcon size={DEFAULT_ICON_SIZES.SMALL} />}
                    onClick={handleToggleFullScreen}
                    aria-label={isFullScreen ? 'Minimize' : 'Maximize'}
                  />
                )}
                {!isFullScreen && (
                  <DialGhostIconButton
                    size={ElementSize.Small}
                    icon={
                      <ChevronDown
                        height={DEFAULT_ICON_SIZES.SMALL}
                        width={DEFAULT_ICON_SIZES.SMALL}
                        className={classNames(
                          'shrink-0 transition',
                          isOpened && 'rotate-180',
                        )}
                      />
                    }
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
                  className="link-icon-button-small"
                >
                  <IconDownload size={DEFAULT_ICON_SIZES.SMALL} />
                </a>
              )
            )}
          </div>
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
          {mappedAttachmentReferenceUrl &&
            (isPdfReference ? (
              <button
                type="button"
                onClick={(e) => {
                  stopBubbling(e);
                  setOpenPdfUrl(mappedAttachmentReferenceUrl);
                }}
                className="mt-3 block text-start text-accent-primary"
              >
                {t(ChatI18nKeys.Reference)}
              </button>
            ) : (
              <a
                href={mappedAttachmentReferenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block text-accent-primary"
              >
                {t(ChatI18nKeys.Reference)}
              </a>
            ))}
        </div>
      )}
      {openPdfUrl && (
        <PdfPreviewModal
          url={openPdfUrl}
          title={attachment.title}
          onClose={handleClosePdfPreview}
        />
      )}
    </div>
  );
};
