/** Layer names the `interaction-cat-borrow-v1` adapter reads or fits. */
export enum CatBorrowSlot {
  /** The precomposition holding the character; the adapter writes its time remap. */
  Rig = 'cat-rig',
  /** The null whose position keyframes are the stations. */
  Root = 'cat-root',
  /** The null whose hold x-scale keyframes carry the facing. */
  Facing = 'cat-facing',
  /** The floor glow under grounded copies; one static rectangle. */
  Floor = 'cat-floor',
}

/** Measured points the stations bind to; `anchor:<name>` nulls hold their reference positions. */
export enum CatBorrowAnchor {
  /** The viewport edge the cat enters from. */
  EntryEdge = 'entry-edge',
  /** The composer's top edge above the first stand point. */
  Perch = 'perch',
  /** The first button's near inline edge on its bottom edge. */
  Prize0 = 'prize-0',
  /** The second button's near inline edge on its bottom edge. */
  Prize1 = 'prize-1',
  /** Where the cat stands after the first button's pushes; its side is the walk toward the second. */
  Move = 'move',
  /** The viewport edge the cat leaves through. */
  ExitEdge = 'exit-edge',
}

/** The story sections of a cat-borrow asset. */
export enum CatBorrowSection {
  /** Two buttons. */
  TwoPrizes = 'two-prizes',
  /** One button; standalone, or the tail after `cat:branch:one-prize`. */
  OnePrize = 'one-prize',
  /** No reachable button: the cat crosses the page. */
  Crossing = 'crossing',
}

/** Kinds of `cat:` markers. */
export enum CatBorrowMarker {
  /** A section's range. */
  Section = 'section',
  /** Where the one-prize story leaves the two-prize section. */
  Branch = 'branch',
  /** A range of station keyframes bound to one anchor. */
  Bind = 'bind',
  /** The copy appears and the original hides. */
  Entry = 'entry',
  /** A paw contact instant. */
  Contact = 'contact',
  /** The push ends and physics takes the copy. */
  Release = 'release',
  /** The authored landing, with an optional elastic range. */
  Landing = 'landing',
  /** The copies fade back to their originals. */
  Restore = 'restore',
}
