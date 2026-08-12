/** Which prompt namespace a catalog prompt item came from. */
export enum PromptSource {
  /** The caller's own prompt, editable and deletable by them. */
  Personal = 'personal',
  /** Shared with the caller by another user; read-only. */
  SharedWithMe = 'sharedWithMe',
  /** Organisation-wide prompt; read-only for every user. */
  Public = 'public',
}

/** Why a prompt-editor field failed client-side validation. */
export enum PromptFieldError {
  /** The field is required and was left empty. */
  Required = 'required',
  /** The value exceeds the backend's length limit for the field. */
  TooLong = 'tooLong',
  /** The name contains characters the backend's allowlist rejects. */
  InvalidName = 'invalidName',
  /** The backend reported an existing prompt or folder at the target path. */
  Conflict = 'conflict',
}
