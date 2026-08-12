import {
  AttachmentErrorReason,
  mergeClasses,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import { Spinner, Highlight } from '@epam/ai-dial-ui-kit';
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

/** Non-previewable attachment tile showing a file type glyph, extension label, and filename with upload-state feedback. */
export const FileAttachment: FC<FileAttachmentProps> = ({
  attachment,
  searchQuery = '',
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
  isSelected,
}) => {
  const {
    clickLabel = 'Download attachment',
    retryLabel = 'Retry upload',
    sizeLabel,
    uploadingLabel = 'Uploading',
    errorReasonLabels,
    genericErrorLabel = 'Upload failed',
  } = labels ?? {};
  const { typography, className } = rowStyles ?? {};

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
    'group/attachment-tile relative flex-col justify-between items-start gap-1 overflow-hidden p-1.5',
    styles.tile,
    !isError && styles.hovered,
    isSelected && styles.selected,
    isError && styles.tileError,
  );

  const nameEl = (
    <div
      title={displayName}
      className={mergeClasses(
        typography?.nameClassName ?? 'dial-caption-text',
        'line-clamp-2 min-w-0 break-all',
        styles.nameText,
        !isError && cornerIconSpacing,
      )}
    >
      {searchQuery ? (
        <Highlight text={displayName} query={searchQuery} maxLines={2} />
      ) : (
        displayName
      )}
    </div>
  );

  const typeRow = Glyph && (
    <div
      className={mergeClasses(
        'flex w-full items-center gap-1',
        isError && cornerIconSpacing,
      )}
    >
      <Glyph size={16} className={styles.typeText} aria-hidden />

      <span
        className={mergeClasses(
          typography?.metaClassName ?? 'dial-caption-text',
          'min-w-0 flex-1 truncate',
          styles.typeText,
        )}
      >
        {sizeLabel ? `${typeLabel} · ${sizeLabel}` : typeLabel}
      </span>
    </div>
  );

  const handleClick = (): void => {
    if (isExpandable && onExpand) {
      onExpand(id);
    } else if (onClick) {
      onClick(id);
    }
  };

  const tileContent = (
    <>
      {nameEl}
      {typeRow}

      {isLoading && (
        <div
          aria-label={uploadingLabel}
          className={mergeClasses(
            'absolute left-[-1px] top-[-1px] flex size-full items-center justify-center rounded',
            styles.track,
          )}
        >
          <Spinner size={32} />
        </div>
      )}

      <div className={mergeClasses('absolute right-0 top-0 flex gap-1')}>
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
            id={id}
          />
        )}
      </div>

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
        onClick={handleClick}
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
