import { buildCssVars } from '@epam/ai-dial-chat-shared';
import { CSSProperties } from 'react';
import { CatalogStyles } from '../models/catalog-styles';

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
