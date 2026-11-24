/** Layer names the `interaction-copy-track-v1` adapter reads or fits. */
export enum CopyTrackSlot {
  /** The precomposition holding the actor; the adapter writes its time remap. */
  Actor = 'ct-actor',
  /** The root null that carries the actor through walk windows. */
  Travel = 'ct-travel',
  /** The null whose hold x-scale keyframes carry the actor's facing. */
  Facing = 'ct-facing',
  /** The static shape whose height is the cast band at the reference floor. */
  Band = 'ct-band',
  /** The track null of the actor's stations. */
  Root = 'ct-track:root',
  /** The track null a copy follows. */
  Copy = 'ct-track:copy',
}

/** Section kinds; each names one stage and at most one copy role. */
export enum CopyTrackSectionKind {
  /** Under the bottom starter row, with a starter card. */
  LedgeCard = 'ledge-card',
  /** On the composer's upper edge, with a starter card. */
  RimCard = 'rim-card',
  /** On the composer's upper edge, with no copy. */
  Rim = 'rim',
  /** Below the lowest host content, with no copy. */
  Platform = 'platform',
  /** On the composer's upper edge, with a composer word. */
  RimWord = 'rim-word',
}

/** Stage templates the adapter measures. */
export enum CopyTrackStage {
  /** Under the bottom starter row. */
  Ledge = 'ledge',
  /** On the composer's upper edge. */
  Rim = 'rim',
  /** Below the lowest host content. */
  Platform = 'platform',
}

/** Copy roles the adapter resolves. */
export enum CopyTrackRole {
  /** One eligible starter button, copied as an inert clone. */
  StarterCard = 'starter-card',
  /** The first text run of the composer textarea, copied as an inert span over a cover. */
  ComposerWord = 'composer-word',
}

/** Measured points the tracks bind to; `anchor:<name>` nulls hold their reference positions. */
export enum CopyTrackAnchor {
  /** Where the actor enters, clamped to the welcome bounds. */
  EntryEdge = 'entry-edge',
  /** The stage's stance point. */
  Stance = 'stance',
  /** The copy's near-bottom corner. */
  Copy = 'copy',
  /** The start of travel; stretchable. */
  SpanStart = 'span-start',
  /** The end of travel; stretchable. */
  SpanEnd = 'span-end',
  /** The point beyond the span; stretchable. */
  Far = 'far',
  /** Where the actor leaves, clamped to the welcome bounds. */
  ExitEdge = 'exit-edge',
}

/** Contact instants the checks and tests measure. */
export enum CopyTrackContact {
  /** A hand grips the copy or the drawn sled. */
  Grip = 'grip',
  /** The actor sits on the copy or the drawn sled. */
  Seat = 'seat',
  /** The ride hits the obstacle at the span's end. */
  Impact = 'impact',
  /** A flying part lodges at the far point. */
  Lodge = 'lodge',
  /** The copy is back on its original. */
  Slot = 'slot',
  /** A hand catches a falling part. */
  Catch = 'catch',
}

/** Kinds of `ct:` markers. */
export enum CopyTrackMarker {
  /** Declares a section, in priority order. */
  Section = 'section',
  /** The shared story every section plays outside its splices. */
  Trunk = 'trunk',
  /** A trunk range a section replaces. */
  Cut = 'cut',
  /** The window that replaces the matching cut. */
  Fill = 'fill',
  /** A range of track keyframes bound to one anchor. */
  Bind = 'bind',
  /** A range of track keyframes stretched between the binds on each side. */
  Stretch = 'stretch',
  /** One repeatable step cycle. */
  Cycle = 'cycle',
  /** The trunk range a step cycle repeats over. */
  CycleWindow = 'cycle-window',
  /** The copy appears and the original hides. */
  Entry = 'entry',
  /** The copy fades and the original returns. */
  Restore = 'restore',
  /** A contact instant. */
  Contact = 'contact',
}
