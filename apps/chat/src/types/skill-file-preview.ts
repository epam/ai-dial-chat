/** Presentation state of the Skill Editor's inline supporting-file preview. */
export enum SkillFilePreviewState {
  /** An open for the currently selected file is in flight. */
  Loading = 'loading',
  /** The canvas holds the currently selected file's content. */
  Ready = 'ready',
  /** The open for the currently selected file failed and can be retried. */
  Error = 'error',
}
