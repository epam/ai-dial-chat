/** How a staged upload whose path already holds a file in the skill is resolved. */
export enum SkillFileConflictResolution {
  /** The upload overwrites the existing file at the same path. */
  Replace = 'replace',
  /** The upload is staged under a free `name (n).ext` path beside the existing file. */
  Duplicate = 'duplicate',
}
