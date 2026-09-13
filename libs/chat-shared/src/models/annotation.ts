/** Selector that targets a character range in a text string. All indices are inclusive. */
export interface TextCharacterRangeSelector {
  /** Discriminator — always `'text_character_range'`. */
  type: 'text_character_range';
  /** Zero-based start index (inclusive). */
  start: number;
  /** Zero-based end index (inclusive). */
  end: number;
}

/** Selector that targets an axis-aligned bounding box on a specific PDF page. */
export interface PdfBBoxSelector {
  /** Discriminator — always `'pdf_bbox'`. */
  type: 'pdf_bbox';
  /** 1-based PDF page number. */
  page: number;
  /** Left edge coordinate. */
  x1: number;
  /** Top edge coordinate. */
  y1: number;
  /** Right edge coordinate. */
  x2: number;
  /** Bottom edge coordinate. */
  y2: number;
}

/** Selector that targets a paired inline tag (e.g. `<cit data-id="…"></cit>`) by its `id` value. */
export interface HtmlTagSelector {
  /** Discriminator — always `'html_tag'`. */
  type: 'html_tag';
  /** The tag name (e.g. `'cit'`). */
  tag: string;
  /** Matches the tag's `data-id` attribute value in the message text, used to associate this selector with its rendered position. */
  id: string;
}

/**
 * Selector that targets a character range inside a DOCX story. Confirmed
 * against captured DIAL Core responses: unlike {@link TextCharacterRangeSelector},
 * `end` is already exclusive on the wire, not inclusive.
 */
export interface DocxRangeSelector {
  /** Discriminator — always `'docx_text_range'`. */
  type: 'docx_text_range';
  /** Name of the DOCX story the range lives in, as an opaque string (only `'body'` is confirmed upstream — no closed set). */
  story: string;
  /** Source-tree element indices identifying the paragraph, matched element-wise. */
  path: number[];
  /** Zero-based start character offset within the story's matched text. */
  start: number;
  /** Zero-based end character offset — already exclusive on the wire. */
  end: number;
  /** The cited text, expected to equal the text resolved over `[start, end)`. */
  text: string;
}

/**
 * Selector that targets a character range inside a single shape on one PPTX
 * slide. Confirmed against captured DIAL Core responses: unlike
 * {@link TextCharacterRangeSelector}, `end` is already exclusive on the wire.
 */
export interface PptxRangeSelector {
  /** Discriminator — always `'pptx_text_range'`. */
  type: 'pptx_text_range';
  /** 1-based slide number. */
  slide: number;
  /** Shape identifier, compared as a string against the run's own shape id. */
  shape_id: string;
  /** Zero-based start character offset within the shape's matched text. */
  start: number;
  /** Zero-based end character offset — already exclusive on the wire. */
  end: number;
  /** The cited text, expected to equal the text resolved over `[start, end)`. */
  text: string;
}

/** A 1-based cell address on an XLSX sheet. */
export interface ExcelCellAddress {
  /** 1-based row number. */
  row: number;
  /** 1-based column number. */
  col: number;
}

/** Selector that targets one cell, or a contiguous same-row cell range, on a named XLSX sheet. */
export interface ExcelRcRangeSelector {
  /** Discriminator — always `'excel_rc_range'`. */
  type: 'excel_rc_range';
  /** Sheet name, matched exactly against the workbook's own sheet names. */
  sheet: string;
  /** First cell of the range. */
  start: ExcelCellAddress;
  /** Last (inclusive) cell of the range, on the same row as `start`. `null` and omitted both mean a single cell. */
  end?: ExcelCellAddress | null;
}

/**
 * Discriminated union of all recognised annotation selector shapes.
 * Unknown selector types are preserved as an open record to allow forward-compatibility.
 */
export type AnnotationSelector =
  | TextCharacterRangeSelector
  | PdfBBoxSelector
  | HtmlTagSelector
  | DocxRangeSelector
  | PptxRangeSelector
  | ExcelRcRangeSelector
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
  /** Human-readable display name for the file. Used in citation markers. */
  title?: string;
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
