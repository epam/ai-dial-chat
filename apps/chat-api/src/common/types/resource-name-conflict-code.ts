/**
 * Domain codes on a `409` that rejects a toolset or agent whose displayed name
 * and version already exist in the caller's own bucket, folder and catalog tab.
 * The kind names the entity that already holds the identity. A conflict that
 * only means "every candidate storage path is taken" carries no code.
 */
export enum ResourceNameConflictCode {
  /** An own application (agent) already has this name and version. */
  NameTakenAgent = 'name-taken-agent',
  /** An own toolset already has this name and version. */
  NameTakenToolset = 'name-taken-toolset',
}
