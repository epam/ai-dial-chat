/** Submit lifecycle; dirty tracking for navigation guards is owned separately. */
export enum SkillEditorSubmitPhase {
  Idle = 'idle',
  Submitting = 'submitting',
  Success = 'success',
  Failure = 'failure',
}
