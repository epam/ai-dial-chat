/** How the unified attachment tile grid should render for a given total attachment count. */
export enum AttachmentTilesLayout {
  /** No attachments. */
  None = 'none',
  /** Below the collapse threshold, or expanded: every tile shown. */
  AllVisible = 'all-visible',
  /** At/above the collapse threshold, not yet expanded: a few tiles + a "+N" tile. */
  Collapsed = 'collapsed',
}

export interface AttachmentTilesPlan {
  layout: AttachmentTilesLayout;
  /** Number of tiles to actually render. */
  visibleCount: number;
  /** Number of attachments hidden behind the "+N" tile (0 unless `layout` is `Collapsed`). */
  hiddenCount: number;
}

/** Total attachment count at/above which the grid collapses behind a "+N" tile by default. */
export const ATTACHMENT_COLLAPSE_THRESHOLD = 5;
/** Number of tiles shown before the "+N" tile while collapsed. */
export const ATTACHMENT_COLLAPSED_VISIBLE_COUNT = 4;

/** Decides how the unified tile grid should render for `totalCount` attachments, given whether the group is expanded. */
export const getAttachmentTilesPlan = (
  totalCount: number,
  isExpanded: boolean,
): AttachmentTilesPlan => {
  if (totalCount <= 0) {
    return {
      layout: AttachmentTilesLayout.None,
      visibleCount: 0,
      hiddenCount: 0,
    };
  }
  if (totalCount < ATTACHMENT_COLLAPSE_THRESHOLD || isExpanded) {
    return {
      layout: AttachmentTilesLayout.AllVisible,
      visibleCount: totalCount,
      hiddenCount: 0,
    };
  }
  return {
    layout: AttachmentTilesLayout.Collapsed,
    visibleCount: ATTACHMENT_COLLAPSED_VISIBLE_COUNT,
    hiddenCount: totalCount - ATTACHMENT_COLLAPSED_VISIBLE_COUNT,
  };
};
