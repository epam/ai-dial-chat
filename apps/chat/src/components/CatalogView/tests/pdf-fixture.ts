import { SKILL_MANIFEST_MAX_BYTES } from '@epam/ai-dial-chat-hooks';

/*
 * A structurally valid minimal PDF, so the preview path is exercised with
 * real parser input rather than an opaque byte blob: header, catalog/pages/
 * page objects, a cross-reference table whose offsets are computed from the
 * assembled bytes, a trailer and `%%EOF`. The padding is a PDF comment line
 * placed before the objects, which is why the `xref` offsets have to be
 * derived rather than hardcoded.
 */
const OBJECT_DICTS = [
  '<</Type/Catalog/Pages 2 0 R>>',
  '<</Type/Pages/Kids[3 0 R]/Count 1>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<<>>>>',
];

const buildPdf = (paddingLength: number): string => {
  let body = `%PDF-1.4\n%${'A'.repeat(paddingLength)}\n`;
  const offsets: number[] = [];

  OBJECT_DICTS.forEach((dict, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${dict}\nendobj\n`;
  });

  const xrefOffset = body.length;
  const entries = offsets
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');

  return (
    `${body}xref\n0 ${OBJECT_DICTS.length + 1}\n0000000000 65535 f \n${entries}` +
    `trailer\n<</Size ${OBJECT_DICTS.length + 1}/Root 1 0 R>>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`
  );
};

/**
 * Builds a valid PDF whose byte length exceeds `SKILL_MANIFEST_MAX_BYTES`.
 * The padding target is derived from the constant, so the fixture keeps
 * straddling the old preview cap if that constant ever changes.
 */
export const createOversizedPdfBytes = (): Uint8Array => {
  const unpadded = buildPdf(0);
  const padding = Math.max(0, SKILL_MANIFEST_MAX_BYTES + 1 - unpadded.length);

  return new TextEncoder().encode(buildPdf(padding));
};
