import { buildCssVars } from '@epam/ai-dial-chat-shared';
import { CSSProperties } from 'react';
import { CatalogStyles } from '../models/CatalogStyles';

export const getStyles = (catalogStyles?: CatalogStyles): CSSProperties => {
  const { colors, typography } = catalogStyles ?? {};

  const hasPageHeadingClass = Boolean(typography?.pageHeadingFontClassName);
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
    '--cat-page-heading-font-family': hasPageHeadingClass
      ? undefined
      : typography?.pageHeadingFontFamily,
    '--cat-page-heading-font-size': hasPageHeadingClass
      ? undefined
      : typography?.pageHeadingFontSize,
    '--cat-page-heading-font-weight': hasPageHeadingClass
      ? undefined
      : typography?.pageHeadingFontWeight?.toString(),
    '--cat-page-heading-line-height': hasPageHeadingClass
      ? undefined
      : typography?.pageHeadingLineHeight,
  });
};
