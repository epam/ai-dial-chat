/** Why a skill's url resolved to no loaded listing entry. */
export enum SkillUnresolvedReason {
  /** The url's bucket is the viewer's own bucket. The viewer's own skill no longer exists. */
  Deleted = 'deleted',
  /** The url's bucket belongs to someone else. A personal skill never shared with the viewer (or since unshared/deleted). */
  NotShared = 'not-shared',
}
