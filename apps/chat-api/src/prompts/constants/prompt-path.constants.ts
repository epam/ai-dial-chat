export const PROMPT_NAME_PATTERN = /^(?!\.{1,2}$)[a-zA-Z0-9 _.-]+$/;

export const PROMPT_PATH_PATTERN =
  /^(?!.*(?:^|\/)\.{1,2}(?:\/|$))(?!.*\/\/)[a-zA-Z0-9 _.-]+(?:\/[a-zA-Z0-9 _.-]+)*$/;

export const OPTIONAL_PROMPT_PATH_PATTERN =
  /^(?:|(?!.*(?:^|\/)\.{1,2}(?:\/|$))(?!.*\/\/)[a-zA-Z0-9 _.-]+(?:\/[a-zA-Z0-9 _.-]+)*)$/;

export const PROMPT_NAME_VALIDATION_MESSAGE =
  'name may only contain letters, digits, spaces, _, ., and - and must not be . or ..';

export const PROMPT_PATH_VALIDATION_MESSAGE =
  'path must contain safe slash-separated segments and must not contain traversal segments';

/*
 * Full prompt resource id: `prompts/{bucket}/{path}`, the same shape every
 * other resource type (`applications/`, `toolsets/`, `conversations/`,
 * `skills/`) already exposes as its one identity field. Owned by this
 * domain (rather than reusing the share domain's `IsCatalogResourcePath`)
 * because it also governs the prompt CRUD/move endpoints, not just sharing.
 */
/*
 * `(?!\.{1,2}\/)` rejects the bucket segment itself being `.` or `..` — it
 * has to run *before* the bucket is consumed, because the traversal
 * lookahead below only looks forward from where it's anchored and can never
 * see backward into a segment already consumed by `[\w.-]+`.
 *
 * The traversal/double-slash lookaheads after the bucket sit between the
 * bucket segment and its separator slash (not after it) so `.*` can still
 * see that slash — placing them after an already-consumed literal `/` would
 * make them blind to a `../` or `//` that starts the path portion right
 * away.
 */
export const PROMPT_ID_PATTERN =
  /^prompts\/(?!\.{1,2}\/)[\w.-]+(?!.*(?:^|\/)\.{1,2}(?:\/|$))(?!.*\/\/)\/[a-zA-Z0-9 _.-]+(?:\/[a-zA-Z0-9 _.-]+)*$/;

export const PROMPT_ID_VALIDATION_MESSAGE =
  'id must be a full prompt resource path (prompts/{bucket}/{path}) with a valid bucket and safe path segments';
