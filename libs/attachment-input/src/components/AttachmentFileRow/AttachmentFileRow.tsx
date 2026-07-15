import {
  AttachmentErrorReason,
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
import { type FC, type KeyboardEvent, type MouseEvent } from 'react';
import type { AttachmentFileRowProps } from '../../models/attachment-file-row';
import { getAttachmentCardState } from '../../utils/attachment';
import styles from './AttachmentFileRow.module.scss';

const ERROR_REASON_TEXT: Record<AttachmentErrorReason, string> = {
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
  className,
}) => {
  const {
    clickLabel = 'Download attachment',
    retryLabel = 'Retry upload',
    sizeLabel,
  } = labels ?? {};
  const {
    nameClassName = 'dial-caption-text',
    metaClassName = 'dial-caption-text',
  } = rowStyles ?? {};
  const { id, name, status, errorReason } = attachment;
  const isLoading = status === RequestStatus.Loading;
  const isError = status === RequestStatus.Error;
  const errorTitle =
    isError &&
    ((errorReason && ERROR_REASON_TEXT[errorReason]) || 'Upload failed');

  /*
   * Same computation the composer's AttachmentCard uses, so the glyph and
   * extension label are guaranteed identical between the two contexts.
   */
  const { BottomIcon: Glyph, typeLabel } = getAttachmentCardState(
    attachment,
    false,
    false,
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
          aria-label="Uploading"
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
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            onRetry(id);
          }}
        />
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
          className={mergeClasses(
            tileClassName,
            'cursor-pointer focus-within:outline focus-within:outline-1 focus-within:outline-offset-1',
          )}
        >
          {tileContent}
        </div>
      ) : (
        <div className={tileClassName} title={errorTitle || undefined}>
          {tileContent}
        </div>
      )}
    </div>
  );
};
