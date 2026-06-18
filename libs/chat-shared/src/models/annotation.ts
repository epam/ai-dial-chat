/** Selector that targets a character range in a text string. All indices are inclusive. */
export interface TextCharacterRangeSelector {
  /** Discriminator — always `'text_character_range'`. */
  type: 'text_character_range';
  /** Zero-based start index (inclusive). */
  start: number;
  /** Zero-based end index (inclusive). */
  end: number;
}

/**
 * Discriminated union of all recognised annotation selector shapes.
 * Unknown selector types are preserved as an open record to allow forward-compatibility.
 */
export type AnnotationSelector =
  | TextCharacterRangeSelector
  | { type: string; [key: string]: unknown };

/** Identifies the part of the message (or a related resource) that the annotation refers to. */
export interface AnnotationTarget {
  /** Source resource being targeted. `null` or absent means the first content part of the response. */
  source?: unknown;
  /** Character-range or document-region selector within the targeted source. */
  selector?: AnnotationSelector;
}

/** A file attachment referenced by a citation — same shape as `MessageAttachment` but scoped to annotations. */
export interface AttachmentResource {
  /** MIME type of the attached file (e.g. `'application/pdf'`). */
  type: string;
  /** Remote URL pointing to the file content. */
  url: string;
}

/** Identifies the cited document attached to the annotation. */
export interface AnnotationSource {
  /** Always `'attachment'` for file-based sources. */
  type: 'attachment';
  /** The cited file — auto-shared by DIAL Core so the recipient can access it. */
  attachment: AttachmentResource;
}

/** Payload of the annotation: the cited text excerpt, its source document, and optional styling hints. */
export interface AnnotationBody {
  /** Human-readable title of the cited section or document. */
  title?: string;
  /** The literal text excerpt being cited. */
  quote?: string;
  /** The cited source document (present when the annotation references a file). */
  source?: AnnotationSource;
  /** Selectors pointing to the cited region within the source document. */
  selector?: AnnotationSelector | AnnotationSelector[];
  /** Client-defined styling hints (e.g. highlight color). Treated as open-ended; unknown keys are preserved. */
  configuration?: Record<string, unknown>;
}

/** A single annotation attached to an assistant message, optionally citing a source document. */
export interface Annotation {
  /** Zero-based position in the annotation list; used to merge streaming delta updates. */
  index?: number;
  /** Which part of the message text (or a request resource) is annotated. */
  target?: AnnotationTarget;
  /** The annotation payload: quoted text, source document, and optional styling. */
  body?: AnnotationBody;
}
