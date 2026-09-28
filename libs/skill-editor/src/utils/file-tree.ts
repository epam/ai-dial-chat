import { DialFileNodeType } from '@epam/ai-dial-react-file-manager';
import type { DialFile } from '@epam/ai-dial-react-file-manager';
import type { SkillFileTreeNode } from '../models/skill-editor-props';
import { SkillAddSource } from '../types/skill-add-source';
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
      ensureFolder(node.path).name = node.name;
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

/** Joins a folder path (`''` for the skill root) and a relative path below it. */
export const joinSkillPath = (
  folderPath: string,
  relativePath: string,
): string => (folderPath ? `${folderPath}/${relativePath}` : relativePath);

/** The folder containing `path`, or `''` for a top-level entry. */
export const parentSkillPath = (path: string): string =>
  splitParentPath(path) ?? '';

/**
 * Resolves the folder an add action targets (`''` is the skill root). The
 * header adds into the selected folder, or the root when a file (or nothing)
 * is selected; "Add child" adds into the node; "Add sibling" adds next to it.
 */
export const resolveAddTarget = (
  source: SkillAddSource,
  node: SkillFileTreeNode | undefined,
): string => {
  if (!node) return '';
  switch (source) {
    case SkillAddSource.Child:
      return node.path;
    case SkillAddSource.Sibling:
      return parentSkillPath(node.path);
    case SkillAddSource.Header:
      return node.kind === SkillFileNodeKind.Folder ? node.path : '';
  }
};

/**
 * Names of the direct children of `folderPath`, including folders that exist
 * only implicitly through a deeper file path.
 */
export const listChildNames = (
  nodes: SkillFileTreeNode[],
  folderPath: string,
): Set<string> => {
  const prefix = folderPath ? `${folderPath}/` : '';
  const names = new Set<string>();
  for (const { path } of nodes) {
    if (!path.startsWith(prefix) || path === folderPath) continue;
    const rest = path.slice(prefix.length);
    names.add(rest.split('/')[0]);
  }
  return names;
};

/** Messages `validateFolderName` returns, resolved from the editor's labels. */
export interface FolderNameMessages {
  /** The trimmed name is empty. */
  required: string;
  /** The name contains a separator or is `.`/`..`. */
  invalid: string;
  /** A sibling with the same name already exists. */
  duplicate: string;
}

/**
 * Structural checks for a folder being named inline, in order: required,
 * separators and dot segments, then a clash with an existing sibling (or the
 * root `SKILL.md`). Returns the first failing message, or `undefined`.
 */
export const validateFolderName = (
  rawName: string,
  siblingNames: Set<string>,
  messages: FolderNameMessages,
): string | undefined => {
  const name = rawName.trim();
  if (!name) return messages.required;
  if (/[/\\]/.test(name) || name === '.' || name === '..') {
    return messages.invalid;
  }
  if (siblingNames.has(name)) return messages.duplicate;
  return undefined;
};
