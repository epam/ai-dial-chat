import { buildCssVars } from '@epam/ai-dial-chat-shared';
import { CSSProperties } from 'react';
import { ENTITY_TYPE_COLOR } from '../constants/entity-colors';
import { CatalogItem } from '../models/catalog-item';
import { CatalogStyles } from '../models/catalog-styles';

/** Returns CSS custom properties for entity color and shadow when the item is featured, undefined otherwise. */
export const getFeaturedEntityStyle = (
  item: CatalogItem,
): CSSProperties | undefined => {
  if (!item.isFeatured) return undefined;

  return buildCssVars({
    '--entity-color': ENTITY_TYPE_COLOR[item.type],
  });
};

/** Builds CSS custom properties for the `Catalog` component from `CatalogStyles`. */
export const getStyles = (catalogStyles?: CatalogStyles): CSSProperties => {
  const { colors } = catalogStyles ?? {};

  return buildCssVars({
    '--cat-bg': colors?.background,
    '--cat-heading-title-text': colors?.headingTitleText,
  });
};
