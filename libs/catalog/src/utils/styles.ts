import { buildCssVars } from '@epam/ai-dial-chat-shared';
import { CSSProperties } from 'react';
import { CatalogStyles } from '../models/catalog-styles';

/** Builds CSS custom properties for the `Catalog` component from `CatalogStyles`. */
export const getStyles = (catalogStyles?: CatalogStyles): CSSProperties => {
  const { colors } = catalogStyles ?? {};

  return buildCssVars({
    '--cat-bg': colors?.background,
    '--cat-heading-title-text': colors?.headingTitleText,
  });
};
