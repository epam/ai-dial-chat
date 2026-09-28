import type { DialFile } from '@epam/ai-dial-react-file-manager';
import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  SkillEditorFileActions,
  SkillFileTreeNode,
} from '../models/skill-editor-props';
import { SKILL_MANIFEST_PATH } from '../types/skill-editor-defaults';
import { SkillFileNodeKind } from '../types/skill-file-node-kind';
import type { SkillFilesPane } from '../types/skill-files-pane';
import {
  joinSkillPath,
  listChildNames,
  validateFolderName,
  type FolderNameMessages,
} from '../utils/file-tree';

/*
 * A backslash never survives into a real node path: uploaded paths are
 * `/`-normalized and folder names containing one are rejected, so the draft
 * can never collide with an existing node.
 */
const DRAFT_FOLDER_SEGMENT = '\\new-folder';

/** Options accepted by `useDraftFolder`. */
export interface UseDraftFolderOptions {
  /** The editor's current supporting files and folders. */
  files: SkillFileTreeNode[];
  /** Host file actions; `onCreateFolder` and `validateFolderPath` are read. */
  fileActions: Pick<
    SkillEditorFileActions,
    'onCreateFolder' | 'validateFolderPath'
  >;
  /** Name prefilled in the draft. */
  defaultName: string;
  /** Inline validation messages. */
  messages: FolderNameMessages;
  /** Called with a folder path that must be expanded to reveal the draft. */
  onRevealFolder: (path: string) => void;
  /** Called with the path of a folder the host was asked to create. */
  onCreated: (path: string) => void;
}

/** Return value of `useDraftFolder`. */
export interface UseDraftFolderResult {
  /** The draft node to append to the tree, or `undefined` when no folder is being named. */
  draftNode: SkillFileTreeNode | undefined;
  /** Path of the draft node, for `DialFoldersTree`'s `renamedPath`. */
  draftPath: string | undefined;
  /** The Files pane rendering the draft; the other rendering must not show it. */
  draftPane: SkillFilesPane | undefined;
  /** Starts naming a new folder inside `parentPath` (`''` for the root) in `pane`. */
  startDraft: (parentPath: string, pane: SkillFilesPane) => void;
  /** `DialFoldersTree` `onRenameValidate`. */
  handleValidate: (value: string, item: DialFile) => string | null;
  /** `DialFoldersTree` `onRenameSave`. */
  handleSave: (value: string) => void;
  /** `DialFoldersTree` `onRenameCancel`. */
  handleCancel: () => void;
}

interface ValidationCall {
  value: string;
  isValid: boolean;
}

/** Inline "Create folder" state for the skill file tree: one draft node, validated and committed through the host. */
export const useDraftFolder = ({
  files,
  fileActions,
  defaultName,
  messages,
  onRevealFolder,
  onCreated,
}: UseDraftFolderOptions): UseDraftFolderResult => {
  const [draft, setDraft] = useState<{
    parentPath: string;
    pane: SkillFilesPane;
  } | null>(null);
  const parentPath = draft?.parentPath ?? null;
  const lastCallsRef = useRef<ValidationCall[]>([]);

  const draftPath =
    parentPath == null
      ? undefined
      : joinSkillPath(parentPath, DRAFT_FOLDER_SEGMENT);

  const draftNode = useMemo<SkillFileTreeNode | undefined>(
    () =>
      draftPath == null
        ? undefined
        : {
            path: draftPath,
            name: defaultName,
            kind: SkillFileNodeKind.Folder,
          },
    [draftPath, defaultName],
  );

  const validateName = useCallback(
    (value: string, parent: string): string | undefined => {
      const siblings = listChildNames(files, parent);
      if (parent === '') siblings.add(SKILL_MANIFEST_PATH);
      return (
        validateFolderName(value, siblings, messages) ??
        fileActions.validateFolderPath?.(joinSkillPath(parent, value.trim()))
      );
    },
    [files, messages, fileActions],
  );

  const startDraft = useCallback(
    (parent: string, pane: SkillFilesPane) => {
      lastCallsRef.current = [];
      setDraft({ parentPath: parent, pane });
      if (parent !== '') onRevealFolder(parent);
    },
    [onRevealFolder],
  );

  const handleValidate = useCallback(
    (value: string, item: DialFile): string | null => {
      if (parentPath == null || item.path !== draftPath) return null;
      const error = validateName(value, parentPath);
      lastCallsRef.current = [
        ...lastCallsRef.current.slice(-1),
        { value, isValid: error == null },
      ];
      return error ?? null;
    },
    [parentPath, draftPath, validateName],
  );

  const handleCancel = useCallback(() => {
    lastCallsRef.current = [];
    setDraft(null);
  }, []);

  const handleSave = useCallback(
    (value: string) => {
      if (parentPath == null) return;
      /*
       * On Enter/blur with an invalid name, the kit's rename field falls back
       * to the prefilled name and saves that instead (it treats the node as a
       * rename, not a creation). That shows up here as an invalid check of a
       * different value immediately followed by this save; treat it as a
       * cancel so a rejected name never turns into a "New folder".
       */
      const [previous] = lastCallsRef.current;
      const isFallback =
        lastCallsRef.current.length === 2 &&
        previous != null &&
        !previous.isValid &&
        previous.value !== value;
      if (isFallback || validateName(value, parentPath) != null) {
        handleCancel();
        return;
      }
      const path = joinSkillPath(parentPath, value.trim());
      handleCancel();
      fileActions.onCreateFolder?.(path);
      onCreated(path);
    },
    [parentPath, validateName, handleCancel, fileActions, onCreated],
  );

  return {
    draftNode,
    draftPath,
    draftPane: draft?.pane,
    startDraft,
    handleValidate,
    handleSave,
    handleCancel,
  };
};
