import type { DialFile, FolderNode } from '@epam/ai-dial-react-file-manager';
import { DialFileNodeType } from '@epam/ai-dial-react-file-manager';
import { isHiddenPath } from './path';

/** Splits a virtual path (`/My files/reports/`) into its non-empty segments. */
export const toPathSegments = (path: string): string[] =>
  path.split('/').filter(Boolean);

/** Returns true when `path` is `ancestor` or lies inside it; both are compared segment by segment. */
export const isSameOrInsidePath = (path: string, ancestor: string): boolean => {
  const pathSegments = toPathSegments(path);
  const ancestorSegments = toPathSegments(ancestor);
  return (
    ancestorSegments.length > 0 &&
    pathSegments.length >= ancestorSegments.length &&
    ancestorSegments.every((segment, index) => pathSegments[index] === segment)
  );
};

/** Returns the root of the section (tab) the source folder belongs to, or the first root when none matches. */
export const findSectionRoot = (
  roots: DialFile[],
  sourceFolder: string,
): DialFile | undefined => {
  const [sourceRootSegment] = toPathSegments(sourceFolder);
  return (
    roots.find((root) => toPathSegments(root.path)[0] === sourceRootSegment) ??
    roots[0]
  );
};

/** Joins the root path and the segments below it into the virtual path the file manager works with. */
export const toDestinationPath = (rootPath: string, path: string[]): string =>
  [rootPath.replace(/\/$/, ''), ...path].join('/');

/**
 * Turns the folders of a section root into destination tree nodes: folders
 * only, dot-folders left out, paths relative to the root. A folder whose
 * contents are not loaded keeps `children` undefined so the tree does not
 * read it as empty.
 */
export const toDestinationFolderNodes = (
  files: DialFile[] | undefined,
  rootSegmentCount: number,
  isLoaded: (virtualPath: string) => boolean,
): FolderNode[] =>
  (files ?? [])
    .filter(
      (file) =>
        file.nodeType === DialFileNodeType.FOLDER && !isHiddenPath(file.name),
    )
    .map((folder) => {
      const subfolders = (folder.items ?? []).filter(
        (child) => child.nodeType === DialFileNodeType.FOLDER,
      );
      let children: FolderNode[] | undefined;
      if (subfolders.length > 0 || isLoaded(folder.path)) {
        children = toDestinationFolderNodes(
          folder.items,
          rootSegmentCount,
          isLoaded,
        );
      }
      return {
        path: toPathSegments(folder.path).slice(rootSegmentCount),
        name: folder.name,
        children,
      };
    });

/** Finds the folder at `virtualPath` inside `root`, or `undefined` when it is not in the loaded tree. */
export const findFolder = (
  root: DialFile,
  virtualPath: string,
): DialFile | undefined => {
  const target = toPathSegments(virtualPath).join('/');
  if (toPathSegments(root.path).join('/') === target) return root;
  for (const child of root.items ?? []) {
    if (child.nodeType !== DialFileNodeType.FOLDER) continue;
    const found = findFolder(child, virtualPath);
    if (found) return found;
  }
  return undefined;
};
