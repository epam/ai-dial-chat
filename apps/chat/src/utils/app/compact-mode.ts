/** Gap between a message's blocks: text, stages, attachments. */
export const getMessageBlockGapClass = (compactMode: boolean): string =>
  compactMode ? 'gap-2' : 'gap-4';

/**
 * For user messages, which ship a slightly looser default than assistant
 * messages and so need their own pair of values.
 */
export const getUserMessageBlockGapClass = (compactMode: boolean): string =>
  compactMode ? 'gap-2' : 'gap-5';

/**
 * Outer padding of a single message row. `isCompactLayout` is the existing
 * mobile/overlay distinction, which already uses a tighter value; compact mode
 * collapses both to the same minimum.
 */
export const getMessagePaddingClass = (
  compactMode: boolean,
  isCompactLayout: boolean,
): string => {
  if (compactMode) {
    return 'p-2';
  }

  return isCompactLayout ? 'p-3' : 'p-4';
};

/** Desktop vertical padding of a message row. */
export const getMessageDesktopPaddingClass = (compactMode: boolean): string =>
  compactMode ? 'md:py-3' : 'md:py-6';

/** Gap between the message avatar column and the message body. */
export const getMessageDesktopGapClass = (compactMode: boolean): string =>
  compactMode ? 'md:gap-3' : 'md:gap-6';

/** Top offset of the "Show more"/"Show less" stages toggle. */
export const getStagesToggleOffsetClass = (compactMode: boolean): string =>
  compactMode ? 'mt-0.5' : 'mt-1';

/** Bottom margin separating one attachment card from the next. */
export const getAttachmentSpacingClass = (compactMode: boolean): string =>
  compactMode ? 'mb-1 last:mb-0' : 'mb-3 last:mb-0';

/** Top gap before an expanded attachment's content block. */
export const getAttachmentContentOffsetClass = (
  compactMode: boolean,
): string => (compactMode ? 'mt-1' : 'mt-2');

/** Inner padding of an expanded attachment's content block. */
export const getAttachmentContentPaddingClass = (
  compactMode: boolean,
): string => (compactMode ? 'p-2 pt-2' : 'p-3 pt-4');

/** Top offset of an attachment's "Reference" link/button. */
export const getAttachmentReferenceOffsetClass = (
  compactMode: boolean,
): string => (compactMode ? 'mt-1' : 'mt-3');

/** Bottom margin under a grouped-visualizer attachment block. */
export const getAttachmentsGroupSpacingClass = (
  compactMode: boolean,
): string => (compactMode ? 'mb-1' : 'mb-3');

export const getTableSpacingClass = (compactMode: boolean): string =>
  compactMode ? 'mt-1' : 'mt-4';

export const getStagePaddingClass = (compactMode: boolean): string =>
  compactMode ? 'p-1' : 'p-1.5';
