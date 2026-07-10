import type { CatalogItem } from './catalog-item';

/** Text overrides for all user-visible strings in `DetailsPanel`. */
export interface ItemDetailsTexts {
  /** "Share" action button label. Default: `'Share'`. */
  shareLabel?: string;
  /** Caption above the intro/description text. Default: `'Intro'`. */
  introLabel?: string;
  /** "About" tab label. Default: `'About'`. */
  tabAboutLabel?: string;
  /** "Overview" tab label. Default: `'Overview'`. */
  tabOverviewLabel?: string;
  /** "Pricing" tab label. Default: `'Pricing'`. */
  tabPricingLabel?: string;
  /** "API" tab label. Default: `'API'`. */
  tabApiLabel?: string;
  /** Accessible label for the details panel `role="dialog"`. Default: `'Item details'`. */
  ariaLabel?: string;
  /** Accessible label for the close button. Default: `'Close'`. */
  closeAriaLabel?: string;
  /** Accessible label for the star button when the item is not starred. Default: `'Add to favorites'`. */
  addToFavoritesAriaLabel?: string;
  /** Accessible label for the star button when the item is already starred. Default: `'Remove from favorites'`. */
  removeFromFavoritesAriaLabel?: string;
  /** "Yes" label for boolean-true spec values. Default: `'Yes'`. */
  overviewYesLabel?: string;
  /** "No" label for boolean-false spec values. Default: `'No'`. */
  overviewNoLabel?: string;
  /** "Tools" tab label. Default: `'Tools'`. */
  tabToolsLabel?: string;
  /** Label on the "Featured" tag chip shown when the entity is featured. Default: `'Featured'`. */
  featuredLabel?: string;
  /** Primary action button label. Default: `'Use in chat'`. */
  primaryActionLabel?: string;
  /** When `false`, the primary action button is hidden. Default: `true`. */
  hasPrimaryAction?: boolean;
  /** "Edit" action button label. Default: `'Edit'`. */
  editActionLabel?: string;
  /** Label above the daily-limit progress bar. Default: `'Daily limit'`. */
  dailyLimitLabel?: string;
  /** "Resource" section heading in the API tab. Default: `'Resource'`. */
  apiResourceSectionLabel?: string;
  /** "Code snippet" section heading in the API tab. Default: `'Code snippet'`. */
  apiSnippetSectionLabel?: string;
  /** "Model ID" row label in the API tab. Default: `'Model ID'`. */
  apiModelIdLabel?: string;
  /** "Endpoint" section heading in the API tab (multi-endpoint selector). Default: `'Endpoint'`. */
  apiEndpointSectionLabel?: string;
  /** URL row label inside each endpoint option. Default: `'Endpoint'`. */
  apiEndpointLabel?: string;
  /** "Request example" row label in the API tab. Default: `'Request example'`. */
  apiRequestExampleLabel?: string;
  /** "Response schema" row label in the API tab. Default: `'Response schema'`. */
  apiResponseSchemaLabel?: string;
  /** Accessible label for the copy-to-clipboard button. Default: `'Copy'`. */
  copyCodeAriaLabel?: string;
  /** "Token pricing" section heading in the Pricing tab. Default: `'Token pricing'`. */
  pricingPricesSectionLabel?: string;
  /** "Usage limits" section heading in the Pricing tab. Default: `'Usage limits'`. */
  pricingLimitsSectionLabel?: string;
  /** Accessible label for the loading placeholder shown next to the tab row while structured details are being fetched. Default: `'Loading details'`. */
  detailsLoadingAriaLabel?: string;
}

/** Typography class overrides for `DetailsPanel` text elements. */
export interface ItemDetailsTypography {
  /** Typography class for the entity name. Default: `'dial-body-semi-text text-primary'`. */
  nameClassName?: string;
  /** Typography class for the provider label below the entity name. Default: `'dial-tiny-text text-secondary'`. */
  providerClassName?: string;
  /** Typography class for the version string. Default: `'dial-tiny-text'`. */
  versionClassName?: string;
  /** Typography class for the intro section caption. Default: `'dial-caption-text'`. */
  introCaptionClassName?: string;
  /** Typography class for section headings inside the intro/description content. Default: `'dial-small-semi-text'`. */
  contentHeadingClassName?: string;
  /** Typography class for the intro/description body text. Default: `'dial-small-text'`. */
  contentClassName?: string;
  /** Typography class for Overview section headings. Default: `'dial-caption-text'`. */
  overviewSectionClassName?: string;
  /** Typography class for spec row labels (left column). Default: `'dial-small-semi-text'`. */
  overviewLabelClassName?: string;
  /** Typography class for string and "No" spec values. Default: `'dial-small-text'`. */
  overviewValueClassName?: string;
  /** Typography class for "Yes" spec values. Default: `'dial-small-text'`. */
  overviewValueTrueClassName?: string;
  /** Typography class applied to folder path separator labels. Default: `'dial-tiny-text'`. */
  folderLabelClassName?: string;
  /** Typography class applied to the leaf (last) folder path segment. Default: `'dial-tiny-semi-text'`. */
  folderLeafClassName?: string;
}

/** Grouped style overrides for `DetailsPanel`. */
export interface ItemDetailsStyles {
  /** Typography class overrides for text elements. */
  typography?: ItemDetailsTypography;
}

/** Props for `DetailsPanel`. */
export interface DetailsPanelProps {
  /** The catalog item to display in the panel. */
  item: CatalogItem;
  /** Controls whether the panel is visible. */
  isOpen: boolean;
  /** Initial starred state for the item. Default: `false`. */
  isStarred?: boolean;
  /**
   * When `true`, a fetch for structured detail tabs (Overview/Pricing/API/Tools)
   * is pending; the panel shows a small loading indicator next to the tab row.
   */
  isDetailsLoading?: boolean;
  /** Called when the panel should close (close button or backdrop click). */
  onClose: () => void;
  /** Called when the star/favorite button is toggled. */
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
  /** Called when the "Use in chat" button is clicked. */
  onUseInChat?: (item: CatalogItem) => void;
  /** Controls whether the primary action button is shown for the item. */
  isPrimaryActionVisible?: (item: CatalogItem) => boolean;
  /** Called when the "Share" button is clicked. */
  onShare?: (item: CatalogItem) => void;
  /** Called when the "Edit" button is clicked. Shown only when the item's `isEditable` is `true`. */
  onEdit?: (item: CatalogItem) => void;
  /** Text overrides for all user-visible strings. */
  texts?: ItemDetailsTexts;
  /** Grouped style overrides. */
  styles?: ItemDetailsStyles;
}
