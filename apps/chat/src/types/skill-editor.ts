/** Query params the skill editor route reads. */
export enum SkillEditorQuery {
  /** Where to navigate after a successful save or a cancel. */
  ReturnUrl = 'returnUrl',
  /** The skill's relative path within the current user's bucket. Presence switches the page to edit mode. */
  Id = 'id',
}
