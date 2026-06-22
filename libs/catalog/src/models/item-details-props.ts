import type { CatalogItem } from './catalog-item';

/** Text overrides for all user-visible strings in `CatalogItemDetails`. */
export interface ItemDetailsTexts {
  /** "Use in chat" action button label. Default: `'Use in chat'`. */
  useInChatLabel?: string;
  /** "Share" action button label. Default: `'Share'`. */
  shareLabel?: string;
  /** Caption above the short intro text. Default: `'Intro'`. */
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
  /** Label above the daily-limit progress bar. Default: `'Daily limit'`. */
  dailyLimitLabel?: string;
  /** "Resource" section heading in the API tab. Default: `'Resource'`. */
  apiResourceSectionLabel?: string;
  /** "Code snippet" section heading in the API tab. Default: `'Code snippet'`. */
  apiSnippetSectionLabel?: string;
  /** "Model ID" row label in the API tab. Default: `'Model ID'`. */
  apiModelIdLabel?: string;
  /** "Endpoint" row label in the API tab. Default: `'Endpoint'`. */
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
}

/** Typography class overrides for `CatalogItemDetails` text elements. */
export interface ItemDetailsTypography {
  /** Typography class for the entity name. Default: `'dial-display-2-text'`. */
  nameClassName?: string;
  /** Typography class for the version string. Default: `'dial-tiny-text'`. */
  versionClassName?: string;
  /** Typography class for the intro section caption. Default: `'dial-caption-text'`. */
  introCaptionClassName?: string;
  /** Typography class for the short intro description. Default: `'dial-small-text'`. */
  introTextClassName?: string;
  /** Typography class for section headings inside the About tab. Default: `'dial-small-semi-text'`. */
  contentHeadingClassName?: string;
  /** Typography class for the About tab body text. Default: `'dial-small-text'`. */
  contentClassName?: string;
  /** Typography class for Overview section headings. Default: `'dial-caption-text'`. */
  overviewSectionClassName?: string;
  /** Typography class for spec row labels (left column). Default: `'dial-small-semi-text'`. */
  overviewLabelClassName?: string;
  /** Typography class for string and "No" spec values. Default: `'dial-small-text'`. */
  overviewValueClassName?: string;
  /** Typography class for "Yes" spec values. Default: `'dial-small-text'`. */
  overviewValueTrueClassName?: string;
}

/** Grouped style overrides for `CatalogItemDetails`. */
export interface ItemDetailsStyles {
  /** Typography class overrides for text elements. */
  typography?: ItemDetailsTypography;
}

/** Props for `CatalogItemDetails`. */
export interface ItemDetailsProps {
  /** The catalog item to display in the panel. */
  item: CatalogItem;
  /** Controls whether the panel is visible. */
  isOpen: boolean;
  /** Initial starred state for the item. Default: `false`. */
  isStarred?: boolean;
  /**
   * About-tab body text, typically supplied by an async fetch.
   * Falls back to `item.longDescription`, then `item.description`.
   */
  aboutContent?: string;
  /** When `true`, the About tab renders a loading skeleton instead of content. */
  isAboutLoading?: boolean;
  /** Called when the panel should close (close button or backdrop click). */
  onClose: () => void;
  /** Called when the star/favorite button is toggled. */
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
  /** Called when the "Use in chat" button is clicked. */
  onUseInChat?: (item: CatalogItem) => void;
  /** Called when the "Share" button is clicked. */
  onShare?: (item: CatalogItem) => void;
  /** Text overrides for all user-visible strings. */
  texts?: ItemDetailsTexts;
  /** Grouped style overrides. */
  styles?: ItemDetailsStyles;
}
