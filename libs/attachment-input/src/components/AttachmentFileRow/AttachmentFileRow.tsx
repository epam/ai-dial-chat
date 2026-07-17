import {
  AttachmentErrorReason,
  buildCssVars,
  CodeBlockTheme,
  mergeClasses,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialGhostIconButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconDownload, IconReload } from '@tabler/icons-react';
import { type FC, type KeyboardEvent, type MouseEvent, useId } from 'react';
import type { AttachmentFileRowProps } from '../../models/attachment-file-row';
import { getAttachmentCardState } from '../../utils/attachment';
import styles from './AttachmentFileRow.module.scss';

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
export const AttachmentFileRow: FC<AttachmentFileRowProps> = ({
  attachment,
  onClick,
  onRetry,
  labels,
  styles: rowStyles,
  theme = CodeBlockTheme.Dark,
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
    colors,
    className,
  } = rowStyles ?? {};
  const cssVars = buildCssVars({
    '--ci-tile-bg': colors?.background,
    '--ci-tile-border': colors?.border,
    '--ci-tile-border-hover': colors?.borderHover,
    '--ci-tile-focus-outline': colors?.focusOutline,
    '--ci-tile-bg-error': colors?.backgroundError,
    '--ci-tile-border-error': colors?.borderError,
    '--ci-tile-error-text': colors?.errorText,
    '--ci-tile-name-text': colors?.nameText,
    '--ci-tile-type-text': colors?.typeText,
    '--ci-tile-hover-icon-bg': colors?.hoverIconBackground,
    '--ci-tile-hover-icon-color': colors?.hoverIconColor,
    '--ci-tile-track-bg': colors?.trackBackground,
    '--ci-tile-fill-bg': colors?.fillBackground,
  });
  const { id, name, status, errorReason } = attachment;
  const isLoading = status === RequestStatus.Loading;
  const isError = status === RequestStatus.Error;
  const errorDescId = useId();
  const errorTitle =
    isError &&
    ((errorReason &&
      (errorReasonLabels?.[errorReason] ??
        DEFAULT_ERROR_REASON_TEXT[errorReason])) ||
      genericErrorLabel);

  /*
   * Same computation the composer's AttachmentCard uses, so the glyph and
   * extension label are guaranteed identical between the two contexts.
   */
  const { BottomIcon: Glyph, typeLabel } = getAttachmentCardState(
    attachment,
    false,
    false,
    labels,
  );

  const canDownload = !isError && !isLoading && onClick !== undefined;
  /*
   * Matches AttachmentCard: retrying an unsupported file type would just
   * fail again, so no retry action is offered for that specific reason.
   */
  const canRetry =
    isError &&
    !!onRetry &&
    errorReason !== AttachmentErrorReason.UnsupportedType;
  /*
   * The download/retry icon is pinned to the tile's top-end corner (unlike
   * images, which have no text to collide with there) — reserve space in
   * whichever row renders first so wrapped text never runs under it.
   */
  const cornerIconSpacing = canDownload || canRetry ? 'pe-5' : undefined;

  const handleClick = (): void => {
    if (canDownload) onClick?.(attachment);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && canDownload) {
      e.preventDefault();
      handleClick();
    }
  };

  const tileClassName = mergeClasses(
    'group relative flex size-[84px] flex-col justify-between gap-1 overflow-hidden rounded-xl border p-1.5',
    styles.tile,
    !isError && theme === CodeBlockTheme.Light && styles.tileLight,
    isError && styles.tileError,
  );

  const nameEl = (
    <div
      title={name}
      className={mergeClasses(
        nameClassName,
        'line-clamp-2 min-w-0 break-words',
        styles.nameText,
        !isError && cornerIconSpacing,
      )}
    >
      {name}
    </div>
  );

  const typeRow = (
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
        <IconDownload
          size={DIAL_ICON_SIZE.SM}
          aria-hidden
          className={mergeClasses(
            'absolute end-1 top-1 h-6 w-6 rounded-lg p-1 opacity-0 transition-opacity group-hover:opacity-100 mobile:opacity-100',
            styles.hoverIcon,
          )}
        />
      )}

      {canRetry && (
        <DialGhostIconButton
          icon={<IconReload size={DIAL_ICON_SIZE.SM} aria-hidden />}
          size={ElementSize.Small}
          className={mergeClasses(
            'absolute end-1 top-1 h-6 w-6 rounded-lg',
            styles.retryIcon,
          )}
          aria-label={retryLabel}
          aria-describedby={errorTitle ? errorDescId : undefined}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            onRetry(id);
          }}
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
    <div className={mergeClasses('inline-flex', className)}>
      {canDownload ? (
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
      ) : (
        <div
          className={tileClassName}
          title={errorTitle || undefined}
          role={isError ? 'group' : undefined}
          aria-describedby={isError ? errorDescId : undefined}
          tabIndex={isError ? 0 : undefined}
          style={cssVars}
        >
          {tileContent}
        </div>
      )}
    </div>
  );
};
