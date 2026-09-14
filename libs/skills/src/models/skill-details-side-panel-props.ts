import type {
  CatalogContentFilePreview,
  CatalogItem,
  ItemDetailsStyles,
  ItemDetailsTexts,
} from '@epam/ai-dial-catalog';
import type { ReactNode } from 'react';

/**
 * Props for {@link SkillDetailsSidePanel} — the skill-scoped surface of
 * `@epam/ai-dial-catalog`'s `DetailsPanelProps`, narrowed to the actions a
 * skill details surface offers. Publish, share, credentials, and download
 * stay with the Catalog page: omitting them hides those actions. A surface
 * that shows the skill's information only passes `isReadonly` with the
 * primary action and Download hidden.
 */
export interface SkillDetailsSidePanelProps {
  /** The skill catalog item to display in the panel. */
  item: CatalogItem;
  /** Controls whether the panel is visible. */
  isOpen: boolean;
  /** Initial starred state for the skill. Default: `false`. */
  isStarred?: boolean;
  /**
   * When `true`, a fetch for the structured Overview tab is pending; the
   * panel shows a small loading indicator next to the tab row.
   */
  isDetailsLoading?: boolean;
  /**
   * Renders the panel read-only: the favorite star and every mutating action
   * are withheld. The primary action and Download still render unless their
   * own visibility rules hide them. Default: `false`.
   */
  isReadonly?: boolean;
  /** Called when the panel should close (close button or backdrop click). */
  onClose: () => void;
  /** Called when the star/favorite button is toggled. */
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
  /** Called when the header's "Use in chat" button is clicked. */
  onUseInChat?: (item: CatalogItem) => void;
  /** Controls whether the header's primary action button is shown for the skill. */
  isPrimaryActionVisible?: (item: CatalogItem) => boolean;
  /** Narrows which items offer the "Download" action. */
  isDownloadVisible?: (item: CatalogItem) => boolean;
  /**
   * Resolves the text of a file picked in the Content tab, given its opaque
   * `id`. Superseded by `onLoadContentFilePreview` and
   * `renderContentFilePreview` when those are supplied.
   */
  onLoadContentFile?: (fileId: string) => Promise<string | undefined>;
  /**
   * Resolves a picked file's typed preview, given its opaque `id`. Takes
   * precedence over `onLoadContentFile`; superseded by
   * `renderContentFilePreview` when that is supplied.
   */
  onLoadContentFilePreview?: (
    fileId: string,
  ) => Promise<CatalogContentFilePreview | undefined>;
  /**
   * Renders a picked file through a host-owned preview surface. Takes
   * precedence over both loading callbacks. The file id is opaque to the
   * panel; `fileName` is the basename resolved from the supplied tree.
   */
  renderContentFilePreview?: (fileId: string, fileName: string) => ReactNode;
  /** Text overrides for the panel's user-visible strings. */
  texts?: ItemDetailsTexts;
  /** Grouped style overrides. */
  styles?: ItemDetailsStyles;
}
