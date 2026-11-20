/** A marker of one namespace, read from a composition's root `markers`. */
export interface LottieNamespacedMarker {
  /** Marker kind: the segment after the namespace, such as `bind`. */
  kind: string;
  /** Optional argument: the segment after the kind, such as `perch`. */
  argument?: string;
  /** Start, in frames. */
  frame: number;
  /** Length, in frames; `0` for a marker without a duration. */
  duration: number;
}

/** What one marker kind accepts. */
export interface LottieMarkerKindRule {
  /** Allowed arguments; omitted means the kind takes none. */
  arguments?: readonly string[];
  /** How often one kind and argument may occur in a scope. Defaults to `1`. */
  maxPerScope?: number;
  /** `true` requires a duration, `false` forbids one; omitted allows both. */
  duration?: boolean;
  /** Whether ranges of this kind may not overlap within a scope. */
  exclusive?: boolean;
}

/** The markers an adapter reads in its own namespace. */
export interface LottieMarkerVocabulary {
  /** Namespace without the colon, such as `cat`. */
  namespace: string;
  /** Rules keyed by kind; any other kind is malformed. */
  kinds: Readonly<Record<string, LottieMarkerKindRule>>;
  /** Kind whose ranges split the timeline into scopes; every other marker must lie in one. */
  scopeKind?: string;
  /** Kinds whose markers must not go backwards in time within a scope, compared per argument. */
  order?: readonly string[];
}

/** The markers of one scope, by start frame. */
export interface LottieMarkerScope {
  /** The scope's own marker; absent when the vocabulary has no scope kind. */
  marker?: LottieNamespacedMarker;
  /** The other markers inside the scope. */
  markers: LottieNamespacedMarker[];
}

/** The frames markers may use, `from` inclusive and `to` exclusive. */
export interface LottieFrameRange {
  /** First allowed frame. */
  from: number;
  /** First frame past the end. */
  to: number;
}
