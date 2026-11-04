import type { SkillFileNodeKind } from '../types/skill-file-node-kind';
import type { SkillFolderEntry } from '../utils/file-tree';

/** Props for `SkillFolderPreview`. */
export interface SkillFolderPreviewProps {
  /** Path of the folder being previewed, relative to the skill root. */
  folderPath: string;
  /** Direct children of the folder, already ordered. */
  entries: SkillFolderEntry[];
  /** Called with the path and kind of the entry (or ancestor folder) the user opened; `''` is the skill root. */
  onOpen: (path: string, kind: SkillFileNodeKind) => void;
  /** Label of the root breadcrumb. Defaults to `'Skill'`. */
  rootLabel?: string;
  /** Accessible name of the breadcrumb trail. Defaults to `'Folder path'`. */
  breadcrumbAriaLabel?: string;
  /** Accessible name of the button that reveals collapsed breadcrumb segments. Defaults to `'Show hidden path segments'`. */
  overflowAriaLabel?: string;
  /** Accessible name of the list of entries. Defaults to `'Folder content'`. */
  listAriaLabel?: string;
  /** Headline of the empty state. Defaults to `'This folder is empty'`. */
  emptyTitle?: string;
  /** Secondary line of the empty state. Defaults to `'Use Add to upload files or create a subfolder.'`. */
  emptyDescription?: string;
  /** Item-count text of a folder row, given the count. Defaults to `'1 item'` / `'n items'`. */
  itemCountLabel?: (count: number) => string;
  /** Typography class of a row's item count. Defaults to `'dial-tiny-text'`. */
  itemCountClassName?: string;
}
