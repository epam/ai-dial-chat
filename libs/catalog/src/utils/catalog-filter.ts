import type { CatalogItem, TreeNode } from '../models/catalog-item';
import { findNodeLabel } from './catalog-tree';

/** Returns the display label for the Maturity dropdown button. */
export const getMaturityLabel = (
  selected: Set<string>,
  options: string[],
  defaultLabel = 'Maturity',
): string => {
  if (selected.size === 0) return defaultLabel;
  const ordered = options.filter((m) => selected.has(m));
  return ordered.length <= 2
    ? `${defaultLabel}: ${ordered.join(', ')}`
    : `${defaultLabel}: ${ordered.length}`;
};

/** Returns the display label for the Use Case dropdown button. */
export const getUseCaseLabel = (
  selected: Set<string>,
  options: string[],
  defaultLabel = 'Use case',
): string => {
  if (selected.size === 0) return defaultLabel;
  const ordered = options.filter((u) => selected.has(u));
  return ordered.length <= 2
    ? `${defaultLabel}: ${ordered.join(', ')}`
    : `${defaultLabel}: ${ordered.length}`;
};

/** Returns the display label for the Domain dropdown button. */
export const getDomainLabel = (
  selected: Set<string>,
  options: string[],
  defaultLabel = 'Domain',
): string => {
  if (selected.size === 0) return defaultLabel;
  const ordered = options.filter((d) => selected.has(d));
  return ordered.length <= 2
    ? `${defaultLabel}: ${ordered.join(', ')}`
    : `${defaultLabel}: ${ordered.length}`;
};

/**
 * Returns the display label for the From dropdown button.
 * Shows "All except X" when only one node is excluded.
 */
export const getFromLabel = (
  checked: Set<string>,
  allIds: Set<string>,
  tree: TreeNode[],
  defaultLabel = 'From',
): string => {
  const total = allIds.size;
  const n = checked.size;
  if (n === 0 || n === total) return defaultLabel;
  if (total - n === 1) {
    const excludedId = [...allIds].find((id) => !checked.has(id))!;
    return `${defaultLabel}: All except ${findNodeLabel(tree, excludedId) ?? excludedId}`;
  }
  return `${defaultLabel}: ${n} of ${total}`;
};

/** Applies the full filter pipeline: from → domain → useCase → maturity → text query. */
export const filterCatalogItems = (
  items: CatalogItem[],
  opts: {
    fromChecked: Set<string>;
    allFromIds: Set<string>;
    domainSelected: Set<string>;
    useCaseSelected: Set<string>;
    maturitySelected: Set<string>;
    query: string;
  },
): CatalogItem[] => {
  const {
    fromChecked,
    allFromIds,
    domainSelected,
    useCaseSelected,
    maturitySelected,
    query,
  } = opts;
  const q = query.trim().toLowerCase();

  let result = items;

  if (fromChecked.size < allFromIds.size) {
    result = result.filter((item) => fromChecked.has(item.from));
  }
  if (domainSelected.size > 0) {
    result = result.filter((item) => domainSelected.has(item.domain));
  }
  if (useCaseSelected.size > 0) {
    result = result.filter((item) => useCaseSelected.has(item.useCase));
  }
  if (maturitySelected.size > 0) {
    result = result.filter((item) => maturitySelected.has(item.maturity));
  }
  if (q) {
    result = result.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q),
    );
  }

  return result;
};
