import { buildCssVars } from '@epam/ai-dial-chat-shared';
import { CSSProperties } from 'react';
import {
  ENTITY_TYPE_COLOR,
  ENTITY_TYPE_SHADOW,
} from '../constants/entity-colors';
import { CatalogItem } from '../models/catalog-item';
import { CatalogStyles } from '../models/catalog-styles';

/** Returns CSS custom properties for entity color and shadow when the item is featured, undefined otherwise. */
export const getFeaturedEntityStyle = (
  item: CatalogItem,
): CSSProperties | undefined => {
  if (!item.isFeatured) return undefined;

  return buildCssVars({
    '--entity-color': ENTITY_TYPE_COLOR[item.type],
    '--entity-shadow': ENTITY_TYPE_SHADOW[item.type],
  });
};

/** Builds CSS custom properties for the `Catalog` component from `CatalogStyles`. */
export const getStyles = (catalogStyles?: CatalogStyles): CSSProperties => {
  const { colors } = catalogStyles ?? {};

  return buildCssVars({
    '--cat-bg': colors?.background,
    '--cat-text-primary': colors?.text,
    '--cat-text-secondary': colors?.textSecondary,
    '--cat-heading-border': colors?.headingBorder,
    '--cat-heading-bg': colors?.headingBackground,
    '--cat-heading-title-text': colors?.headingTitleText,
    '--cat-content-bg': colors?.contentBackground,
    '--cat-section-heading-text': colors?.sectionHeadingText,
    '--cat-no-results-title-text': colors?.noResultsTitleText,
    '--cat-no-results-description-text': colors?.noResultsDescriptionText,
  });
};
