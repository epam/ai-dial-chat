import {
  AttachmentErrorReason,
  mergeClasses,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import {
  type FC,
  type KeyboardEvent,
  useCallback,
  useId,
  useMemo,
} from 'react';
import { ATTACHMENT_TILE_BASE_CLASS } from '../../../constants/attachment-group';
import type { FileAttachmentProps } from '../../../models/attachment-file-row';
import {
  getAttachmentCardState,
  getNameWithoutExtension,
} from '../../../utils/attachment';
import {
  DownloadAction,
  OpenLinkAction,
  ReloadAction,
  RemoveAction,
} from './Actions';
import styles from './Attachment.module.scss';

const DEFAULT_ERROR_REASON_TEXT: Record<AttachmentErrorReason, string> = {
  [AttachmentErrorReason.Network]: 'Upload failed · network error',
  [AttachmentErrorReason.UnsupportedType]:
    'Upload failed · unsupported file type',
};

/**
 * Non-previewable attachment tile: a uniform neutral square holding the
 * glyph, extension label, and filename together (no external caption, no
 * per-type color). Type is communicated by glyph + extension text only;
 * color is reserved for upload state (failed = red tile + icon-only retry,
 * uploading = progress bar). Download/retry are icon-only, matching the
 * rest of the app.
 */
export const FileAttachment: FC<FileAttachmentProps> = ({
  attachment,
  onClick,
  onRetry,
  labels,
  styles: rowStyles,
  onDownload,
  isPasted,
  isLink,
  cssVars,
  onExpand,
  isExpandable,
  onRemove,
}) => {
  const {
    clickLabel = 'Download attachment',
    retryLabel = 'Retry upload',
    sizeLabel,
    uploadingLabel = 'Uploading',
    errorReasonLabels,
    genericErrorLabel = 'Upload failed',
  } = labels ?? {};
  const {
    typography: {
      nameClassName = 'dial-caption-text',
      metaClassName = 'dial-caption-text',
    } = {},
    className,
  } = rowStyles ?? {};

  const { id, name, status, errorReason } = attachment;

  const isLoading = status === RequestStatus.Loading;
  const isError = status === RequestStatus.Error;
  const errorDescId = useId();
  const errorTitle = isError
    ? (errorReason &&
        (errorReasonLabels?.[errorReason] ??
          DEFAULT_ERROR_REASON_TEXT[errorReason])) ||
      genericErrorLabel
    : '';

  const { BottomIcon: Glyph, typeLabel } = getAttachmentCardState(attachment);

  const canDownload = !isError && !isLoading && onDownload && !isLink;

  const canRetry =
    isError &&
    !!onRetry &&
    errorReason !== AttachmentErrorReason.UnsupportedType;

  const cornerIconSpacing = canDownload || canRetry ? 'pe-5' : undefined;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(attachment.id);
    }
  };

  const displayName = useMemo(() => {
    return isPasted ? name : getNameWithoutExtension(name);
  }, [isPasted, name]);

  const onOpenInNewTab = useCallback((): void => {
    window.open(attachment.referenceUrl, '_blank', 'noopener,noreferrer');
  }, [attachment]);

  const tileClassName = mergeClasses(
    ATTACHMENT_TILE_BASE_CLASS,
    'group relative flex-col justify-between items-start gap-1 overflow-hidden p-1.5',
    styles.tile,
    !isError && styles.tileLight,
    isError && styles.tileError,
  );

  const nameEl = (
    <div
      title={displayName}
      className={mergeClasses(
        nameClassName,
        'line-clamp-2 min-w-0 break-all',
        styles.nameText,
        !isError && cornerIconSpacing,
      )}
    >
      {displayName}
    </div>
  );

  const typeRow = Glyph && (
    <div
      className={mergeClasses(
        'flex items-center gap-1 overflow-hidden',
        isError && cornerIconSpacing,
      )}
    >
      <Glyph size={16} className={styles.typeText} aria-hidden />
      <span
        className={mergeClasses(metaClassName, 'truncate', styles.typeText)}
      >
        {sizeLabel ? `${typeLabel} · ${sizeLabel}` : typeLabel}
      </span>
    </div>
  );

  const tileContent = (
    <>
      {isError ? (
        <>
          {typeRow}
          {nameEl}
        </>
      ) : (
        <>
          {nameEl}
          {typeRow}
        </>
      )}

      {isLoading && (
        <div
          role="progressbar"
          aria-label={uploadingLabel}
          className={mergeClasses(
            'absolute inset-x-2 bottom-2 h-[3px] overflow-hidden rounded-full',
            styles.track,
          )}
        >
          <div
            className={mergeClasses(
              'h-full w-1/3 rounded-full',
              styles.indeterminateFill,
            )}
          />
        </div>
      )}

      {canDownload && (
        <DownloadAction
          ariaLabel={clickLabel}
          errorTitle={errorTitle}
          errorDescId={errorDescId}
          onClick={onDownload}
          id={id}
        />
      )}

      {canRetry && (
        <ReloadAction
          ariaLabel={retryLabel}
          errorTitle={errorTitle}
          errorDescId={errorDescId}
          onClick={onRetry}
          id={id}
        />
      )}

      {isLink && (
        <OpenLinkAction
          ariaLabel={retryLabel}
          errorTitle={errorTitle}
          errorDescId={errorDescId}
          onClick={onOpenInNewTab}
        />
      )}

      {onRemove && (
        <RemoveAction
          ariaLabel={retryLabel}
          errorTitle={errorTitle}
          errorDescId={errorDescId}
          onClick={onRemove}
        />
      )}

      {isError && (
        <span
          id={errorDescId}
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {errorTitle}
        </span>
      )}
    </>
  );

  return (
    <div style={cssVars} className={mergeClasses('inline-flex', className)}>
      <div
        role="button"
        tabIndex={0}
        aria-label={clickLabel}
        onClick={onClick ? () => onClick(id) : undefined}
        onKeyDown={handleKeyDown}
        style={cssVars}
        className={mergeClasses(
          tileClassName,
          'cursor-pointer focus-within:outline focus-within:outline-1 focus-within:outline-offset-1',
        )}
      >
        {tileContent}
      </div>
    </div>
  );
};
