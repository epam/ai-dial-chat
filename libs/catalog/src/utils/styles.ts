import { buildCssVars } from '@epam/ai-dial-chat-shared';
import { CSSProperties } from 'react';
import { ENTITY_TYPE_COLOR } from '../constants/entity-colors';
import { CatalogItem } from '../models/catalog-item';
import { CatalogColors, CatalogStyles } from '../models/catalog-styles';

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

/**
 * Builds CSS custom properties for the "Create" dropdown menu. Kept separate
 * from `getStyles` because the menu is portalled out of the catalog root, so
 * the root's variables never cascade into it.
 */
export const getCreateMenuStyles = (colors?: CatalogColors): CSSProperties => {
  return buildCssVars({
    '--cat-create-menu-bg': colors?.createMenuBackground,
    '--cat-create-item-hover-bg': colors?.createItemHoverBackground,
    '--cat-create-focus-outline': colors?.createItemFocusOutline,
    '--cat-create-item-label': colors?.createItemLabelText,
    '--cat-create-item-description': colors?.createItemDescriptionText,
  });
};
