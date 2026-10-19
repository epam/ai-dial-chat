import {
  AttachmentErrorReason,
  mergeClasses,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import {
  DialItemType,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  FileIcon,
  Highlight,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import {
  type FC,
  type HTMLAttributes,
  type KeyboardEvent,
  useCallback,
  useId,
  useMemo,
} from 'react';
import {
  ATTACHMENT_TILE_BASE_CLASS,
  ATTACHMENT_TILE_FOCUS_RING_CLASS,
} from '../../../constants/attachment-group';
import { ATTACHMENT_INPUT_CLASS } from '../../../constants/public-class-names';
import type { FileAttachmentProps } from '../../../models/attachment-file-row';
import {
  getAttachmentCardState,
  getAttachmentExtension,
  getNameWithoutExtension,
  hasFileTypeGlyph,
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
  [AttachmentErrorReason.FileTooLarge]: 'Upload failed · file too large',
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
  isLink,
  cssVars,
  onExpand,
  isExpandable,
  onRemove,
  isSelected,
}) => {
  const {
    clickLabel = 'Download attachment',
    expandLabel = 'Expand pasted text',
    downloadLabel = 'Download attachment',
    retryLabel = 'Retry upload',
    removeLabel = 'Remove attachment',
    openInNewTabLabel = 'Open in new tab',
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
  const isFileTypeGlyph = hasFileTypeGlyph(attachment);

  const canDownload = !isError && !isLoading && onDownload && !isLink;

  const canRetry =
    isError &&
    !!onRetry &&
    errorReason !== AttachmentErrorReason.UnsupportedType &&
    errorReason !== AttachmentErrorReason.FileTooLarge;

  /*
   * Expanding a pasted tile takes precedence over `onClick`. The tile is a
   * button only when one of the two applies; otherwise it is a plain element so
   * it adds no no-op Tab stop.
   */
  const isExpandAction = !!isExpandable && onExpand !== undefined;
  const hasAction = isExpandAction || onClick !== undefined;
  const actionCount =
    Number(!!canDownload) +
    Number(!!canRetry) +
    Number(!!isLink) +
    Number(!!onRemove);
  /*
   * With a single focus stop inside a non-interactive tile, the tile ring
   * stands for that action's focus. Otherwise each focus stop keeps its own
   * ring, so it stays clear which one has focus.
   */
  const isProxyFocus = !hasAction && actionCount === 1;

  const handleClick = (): void => {
    if (isExpandAction) {
      onExpand(id);
    } else {
      onClick?.(id);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    /*
     * Only the tile itself activates on Enter/Space. Without this guard the
     * preventDefault() below cancels the native activation of the corner
     * action buttons whose key events bubble through here, leaving retry and
     * remove dead to the keyboard.
     */
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const displayName = useMemo(() => getNameWithoutExtension(name), [name]);

  const onOpenInNewTab = useCallback((): void => {
    window.open(attachment.referenceUrl, '_blank', 'noopener,noreferrer');
  }, [attachment]);

  const tileClassName = mergeClasses(
    ATTACHMENT_TILE_BASE_CLASS,
    'group/attachment-tile relative flex-col justify-between items-start gap-2 overflow-hidden p-3',
    styles.tile,
    hasAction && !isError && !isLoading && styles.hovered,
    isLoading && styles.loading,
    isSelected && styles.selected,
    isError && styles.tileError,
    isProxyFocus && styles.proxyFocus,
    ATTACHMENT_INPUT_CLASS.tile,
    isSelected && ATTACHMENT_INPUT_CLASS.tileSelected,
  );

  const nameEl = (
    <div
      title={displayName}
      className={mergeClasses(
        typography?.nameClassName ?? 'dial-tiny-text',
        /*
         * `w-full` is load-bearing here: the tile is a fixed-width (100px)
         * column flex container with `items-start`, so the name div is sized to
         * its min-content width. `break-words` (overflow-wrap: break-word) does
         * not shrink min-content, so a filename with one long unbreakable run
         * made the div wider than the tile — the text was then clipped by the
         * tile's `overflow-hidden` instead of wrapping and clamping with an
         * ellipsis.
         */
        'line-clamp-2 w-full min-w-0 break-words',
        styles.nameText,
        ATTACHMENT_INPUT_CLASS.tileName,
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
        'flex w-full items-end gap-1',
        ATTACHMENT_INPUT_CLASS.tileType,
      )}
    >
      {isFileTypeGlyph ? (
        <FileIcon
          type={DialItemType.File}
          name={name ?? ''}
          fileExtension={getAttachmentExtension(attachment)}
          size={DIAL_ICON_SIZE.MD}
          decorative
        />
      ) : (
        <Glyph
          size={DIAL_ICON_SIZE.MD}
          className={styles.typeText}
          stroke={DIAL_KIT_ICON_STROKE}
          aria-hidden
        />
      )}

      <span
        className={mergeClasses(
          typography?.metaClassName ?? 'dial-tiny-text',
          'min-w-0 flex-1 truncate',
          styles.typeText,
        )}
      >
        {sizeLabel ? `${typeLabel} · ${sizeLabel}` : typeLabel}
      </span>
    </div>
  );

  /*
   * Role, Tab stop, name and handlers travel together, so the tile is either a
   * complete button or a plain element — never a focusable no-op.
   */
  const interactiveProps: HTMLAttributes<HTMLDivElement> = hasAction
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-label': isExpandAction ? expandLabel : clickLabel,
        onClick: handleClick,
        onKeyDown: handleKeyDown,
      }
    : {};

  const tileContent = (
    <>
      {nameEl}
      {typeRow}

      {isLoading && (
        /*
         * An aria-label on a plain div names nothing — a generic element has no
         * role to hang a name on, so the upload was invisible to assistive tech.
         * An indeterminate progressbar (a role, a name, no aria-valuenow) is the
         * standard way to say "this is working and there is no percentage".
         */
        <div
          role="progressbar"
          aria-label={uploadingLabel}
          className={mergeClasses(
            'absolute inset-0 flex items-center justify-center rounded-[11px]',
            styles.track,
          )}
        >
          <Spinner size={32} />
        </div>
      )}

      <div className="absolute end-1 top-1 flex">
        {canDownload && (
          <DownloadAction
            ariaLabel={downloadLabel}
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
            ariaLabel={openInNewTabLabel}
            errorTitle={errorTitle}
            errorDescId={errorDescId}
            onClick={onOpenInNewTab}
          />
        )}
        {onRemove && (
          <RemoveAction
            ariaLabel={removeLabel}
            errorTitle={errorTitle}
            errorDescId={errorDescId}
            onClick={onRemove}
            id={id}
            isAlwaysVisible={isLoading}
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
        {...interactiveProps}
        aria-busy={isLoading}
        style={cssVars}
        className={mergeClasses(
          tileClassName,
          hasAction && 'cursor-pointer',
          ATTACHMENT_TILE_FOCUS_RING_CLASS,
        )}
      >
        {tileContent}
      </div>
    </div>
  );
};
