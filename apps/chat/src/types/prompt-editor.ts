/** Query params the prompt editor route reads. */
export enum PromptEditorQuery {
  /** Path of the prompt to edit. Absent opens the editor in create mode. */
  Id = 'id',
  /** Where to navigate after a successful save or a cancel. */
  ReturnUrl = 'returnUrl',
}
