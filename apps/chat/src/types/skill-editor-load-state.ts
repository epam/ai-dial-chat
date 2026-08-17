/** Edit-mode load state for the Skill Editor page; create mode never leaves `Loaded`. */
export enum SkillEditorLoadState {
  Loading = 'loading',
  Loaded = 'loaded',
  Error = 'error',
  Forbidden = 'forbidden',
  NotFound = 'not-found',
}
