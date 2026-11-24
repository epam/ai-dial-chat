/** Which adapter owns a pack preparation's companion payload. */
export enum PackSceneCompanionKind {
  /** The borrowed copies of an `interaction-cat-borrow-v1` scene. */
  CatBorrow = 'cat-borrow',
  /** The copy and watched host of an `interaction-copy-track-v1` scene. */
  CopyTrack = 'copy-track',
  /** The single inert composer copy of an `interaction-composer-carry-v1` scene. */
  ComposerCarry = 'composer-carry',
}
