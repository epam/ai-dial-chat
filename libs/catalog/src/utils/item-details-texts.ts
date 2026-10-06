import type {
  CatalogMarkdownLabels,
  ItemDetailsTexts,
} from '../models/item-details-props';

/** Returns the markdown code-block, table and formula labels carried by `texts`, keyed as `MarkdownRenderer` props. */
export const getCatalogMarkdownLabels = (
  texts: ItemDetailsTexts | undefined,
): CatalogMarkdownLabels => ({
  codeBlockCopyLabel: texts?.copyCodeAriaLabel,
  codeBlockCopiedLabel: texts?.copiedCodeStatusLabel,
  codeBlockDownloadLabel: texts?.downloadCodeAriaLabel,
  tableScrollRegionAriaLabel: texts?.tableScrollRegionAriaLabel,
  mathScrollRegionAriaLabel: texts?.mathScrollRegionAriaLabel,
});
