import type { ProjectItem } from '../models/project-item';
import { ProjectsSortKey } from '../types/projects-sort-key';

/** Returns the projects whose name contains the trimmed query, case-insensitively; all of them for a blank query. */
export const filterProjects = (
  projects: ProjectItem[],
  query: string,
): ProjectItem[] => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return projects;

  return projects.filter((project) =>
    project.name.toLocaleLowerCase().includes(normalizedQuery),
  );
};

/** Returns a sorted copy of the projects in the given order: pinned first, then undated projects last in both date orders. */
export const sortProjects = (
  projects: ProjectItem[],
  sortKey: ProjectsSortKey,
  locale?: string,
): ProjectItem[] => {
  const collator = new Intl.Collator(locale, {
    sensitivity: 'base',
    numeric: true,
  });
  const compareNames = (a: ProjectItem, b: ProjectItem) =>
    collator.compare(a.name, b.name);
  const comparePinned = (a: ProjectItem, b: ProjectItem) =>
    Number(b.isPinned ?? false) - Number(a.isPinned ?? false);

  if (sortKey === ProjectsSortKey.NameAsc) {
    return [...projects].sort(
      (a, b) => comparePinned(a, b) || compareNames(a, b),
    );
  }

  const direction = sortKey === ProjectsSortKey.Oldest ? 1 : -1;
  return [...projects].sort((a, b) => {
    const pinnedOrder = comparePinned(a, b);
    if (pinnedOrder !== 0) return pinnedOrder;
    if (a.updatedAt == null && b.updatedAt == null) return compareNames(a, b);
    if (a.updatedAt == null) return 1;
    if (b.updatedAt == null) return -1;
    return (a.updatedAt - b.updatedAt) * direction || compareNames(a, b);
  });
};
