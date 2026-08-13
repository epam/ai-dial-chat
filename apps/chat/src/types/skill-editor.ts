/** Query params the skill editor route reads. */
export enum SkillEditorQuery {
  /** The skill's relative path within the current user's bucket. Absent opens the editor in create mode. */
  Id = 'id',
  /** Where to navigate after a successful save or a cancel. */
  ReturnUrl = 'returnUrl',
}
