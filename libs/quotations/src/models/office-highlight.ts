import type { ExcelCellAddress } from '@epam/ai-dial-chat-shared';

/**
 * A validated, normalised DOCX character-range location. `endExclusive` is
 * the wire's `end` copied through unchanged — confirmed exclusive on the
 * wire, unlike `TextCharacterRangeSelector`'s inclusive `end` (see the
 * `annotation.ts` normaliser and `design.md` D3 for the evidence).
 */
export interface DocxOfficeHighlightLocation {
  /** Discriminates this location within `OfficeHighlightLocation`. Mirrors the wire selector's `type`. */
  type: 'docx_text_range';
  /** Name of the DOCX story the range lives in, as an opaque string (only `'body'` is confirmed upstream). */
  story: string;
  /** Source-tree element indices identifying the paragraph, matched element-wise. */
  path: number[];
  /** Zero-based start character offset. */
  start: number;
  /** Zero-based exclusive end character offset. */
  endExclusive: number;
  /** The cited text, expected to equal the text resolved over `[start, endExclusive)`. */
  text: string;
}

/**
 * A validated, normalised PPTX character-range location. `endExclusive` is
 * the wire's `end` copied through unchanged — confirmed exclusive on the
 * wire (see `design.md` D3).
 */
export interface PptxOfficeHighlightLocation {
  /** Discriminates this location within `OfficeHighlightLocation`. Mirrors the wire selector's `type`. */
  type: 'pptx_text_range';
  /** 1-based slide number. */
  slide: number;
  /** Shape identifier, compared as a string against the run's own shape id. */
  shapeId: string;
  /** Zero-based start character offset. */
  start: number;
  /** Zero-based exclusive end character offset. */
  endExclusive: number;
  /** The cited text, expected to equal the text resolved over `[start, endExclusive)`. */
  text: string;
}

/** A validated, normalised XLSX cell or same-row cell-range location. */
export interface ExcelOfficeHighlightLocation {
  /** Discriminates this location within `OfficeHighlightLocation`. Mirrors the wire selector's `type`. */
  type: 'excel_rc_range';
  /** Sheet name, matched exactly against the workbook's own sheet names. */
  sheet: string;
  /** First cell of the range. */
  start: ExcelCellAddress;
  /** Last (inclusive) cell of the range, on the same row as `start`. Omitted for a single cell. */
  end?: ExcelCellAddress;
}

/**
 * A validated, normalised Office document highlight location, produced by
 * `annotationToOfficeHighlightLocations`. Intentionally not the
 * `@epam/ai-dial-attachment-canvas` `OoxmlHighlightLocation` shape — this lib
 * must not depend on `attachment-canvas` (that lib's own test already
 * depends on this one, via `annotationsToPdfHighlights`, and a lib-to-lib
 * cycle is not permitted). `libs/chat-hooks`, which already depends on both,
 * maps this into `OoxmlHighlight`/`OoxmlHighlightLocation`.
 */
export type OfficeHighlightLocation =
  | DocxOfficeHighlightLocation
  | PptxOfficeHighlightLocation
  | ExcelOfficeHighlightLocation;
