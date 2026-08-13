/** Query params shared by every entity editor route (Prompt, Skill, Toolset, ...). */
export enum EditorQuery {
  /** Path/id of the entity to edit. Absent opens the editor in create mode. */
  Id = 'id',
  /** Where to navigate after a successful save or a cancel. */
  ReturnUrl = 'returnUrl',
}
