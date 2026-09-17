import type { AnnotationSelector } from '@epam/ai-dial-chat-shared';
import type {
  DocxTableRowOfficeHighlightLocation,
  PptxTableRowOfficeHighlightLocation,
} from '../models/office-highlight';

/*
 * TODO(#8863): Remove this compatibility adapter after the backend emits
 * precise table-cell ranges instead of Markdown row anchors, and persisted
 * anchors no longer require it. https://github.com/epam/ai-dial-chat/issues/8863
 */
const parseTableRow = (text: string): string[] | undefined => {
  const row = text.trim();
  if (!row.startsWith('|') || !row.endsWith('|') || /[\r\n]/.test(row)) {
    return undefined;
  }

  const cells: string[] = [];
  let cell = '';
  for (let index = 1; index < row.length; index += 1) {
    const char = row[index];
    const next = row[index + 1];
    // Markdown backslash escapes only ASCII punctuation, including pipes.
    if (char === '\\' && next != null && /[!-/:-@[-`{-~]/.test(next)) {
      cell += next;
      index += 1;
    } else if (char === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }

  if (
    cell !== '' ||
    cells.length < 2 ||
    cells.every((value) => value === '' || /^:?-{3,}:?$/.test(value))
  ) {
    return undefined;
  }
  return cells;
};

/** Returns a validated table-row location for the temporary Office anchor format. */
export const normalizeOfficeTableAnchor = (
  selector: AnnotationSelector,
):
  | DocxTableRowOfficeHighlightLocation
  | PptxTableRowOfficeHighlightLocation
  | undefined => {
  if (
    selector.type !== 'docx_text_anchor' &&
    selector.type !== 'pptx_text_anchor'
  ) {
    return undefined;
  }
  const value = selector as Record<string, unknown>;
  const { text, occurrence, slide } = value;
  if (
    typeof text !== 'string' ||
    typeof occurrence !== 'number' ||
    !Number.isSafeInteger(occurrence) ||
    occurrence < 1
  ) {
    return undefined;
  }
  const cells = parseTableRow(text);
  if (cells == null) return undefined;

  if (selector.type === 'docx_text_anchor') {
    return { type: 'docx_text_anchor', cells, occurrence };
  }
  if (typeof slide !== 'number' || !Number.isSafeInteger(slide) || slide < 1) {
    return undefined;
  }
  return { type: 'pptx_text_anchor', cells, occurrence, slide };
};
