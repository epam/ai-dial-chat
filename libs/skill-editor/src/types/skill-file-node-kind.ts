/** Kind of entry in the skill's file tree. */
export enum SkillFileNodeKind {
  /** A regular file, including the protected root `SKILL.md`. */
  File = 'file',
  /** A grouping folder that may contain other files/folders. */
  Folder = 'folder',
}
