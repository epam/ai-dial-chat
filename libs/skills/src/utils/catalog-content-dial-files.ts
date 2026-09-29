import { CatalogContentNodeType } from '@epam/ai-dial-catalog';
import type { CatalogContentTreeNode } from '@epam/ai-dial-catalog';
import { DialFileNodeType } from '@epam/ai-dial-react-file-manager';
import type { DialFile } from '@epam/ai-dial-react-file-manager';

/**
 * Maps the details panel's `CatalogContentTreeNode[]` onto the nested
 * `DialFile[]` `DialFoldersTree` renders. A node's opaque `id` becomes the
 * file's `path`, so the tree's `selectedPath` / `expandedPaths` /
 * `onItemClick` speak the panel's ids unchanged — nothing is parsed.
 */
export const mapCatalogContentTreeToDialFiles = (
  nodes: CatalogContentTreeNode[],
  parentPath: string | null = null,
): DialFile[] =>
  nodes.map((node) =>
    node.type === CatalogContentNodeType.Folder
      ? {
          path: node.id,
          name: node.name,
          nodeType: DialFileNodeType.FOLDER,
          parentPath,
          folderId: node.id,
          items: mapCatalogContentTreeToDialFiles(node.items, node.id),
        }
      : {
          path: node.id,
          name: node.name,
          nodeType: DialFileNodeType.ITEM,
          parentPath,
          folderId: parentPath ?? '',
        },
  );
