import { DialFileNodeType } from '@epam/ai-dial-react-file-manager';
import type { DialFile } from '@epam/ai-dial-react-file-manager';
import type { SkillFileTreeNode } from '../models/skill-editor-props';
import { SkillFileNodeKind } from '../types/skill-file-node-kind';

const splitParentPath = (path: string): string | null => {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash === -1 ? null : path.slice(0, lastSlash);
};

const fileName = (path: string): string => {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash === -1 ? path : path.slice(lastSlash + 1);
};

/**
 * Builds the nested `DialFile[]` tree `DialFoldersTree` expects from the flat
 * `SkillFileTreeNode[]` list, synthesising any implicit intermediate folders
 * (e.g. `agents/analyzer.md` implies an `agents` folder even when no explicit
 * folder node was added for it).
 */
export const buildDialFileTree = (nodes: SkillFileTreeNode[]): DialFile[] => {
  const byPath = new Map<string, DialFile>();
  const ensureFolder = (path: string): DialFile => {
    const existing = byPath.get(path);
    if (existing) return existing;
    const folder: DialFile = {
      path,
      name: fileName(path),
      nodeType: DialFileNodeType.FOLDER,
      parentPath: splitParentPath(path),
      folderId: path,
      items: [],
    };
    byPath.set(path, folder);
    return folder;
  };

  for (const node of nodes) {
    if (node.kind === SkillFileNodeKind.Folder) {
      ensureFolder(node.path);
      continue;
    }
    byPath.set(node.path, {
      path: node.path,
      name: node.name,
      nodeType: DialFileNodeType.ITEM,
      parentPath: splitParentPath(node.path),
      folderId: splitParentPath(node.path) ?? '',
    });
  }

  // Synthesise any intermediate folders implied by a deep path.
  for (const node of [...nodes]) {
    let parent = splitParentPath(node.path);
    while (parent != null) {
      ensureFolder(parent);
      parent = splitParentPath(parent);
    }
  }

  const roots: DialFile[] = [];
  for (const item of byPath.values()) {
    if (item.parentPath == null) {
      roots.push(item);
      continue;
    }
    const parent = byPath.get(item.parentPath);
    if (parent) {
      parent.items = [...(parent.items ?? []), item];
    } else {
      roots.push(item);
    }
  }

  return roots;
};
