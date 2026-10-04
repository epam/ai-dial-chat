import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HTML_PREVIEW_FRAME_RENDER_MESSAGE } from '../html-preview-frame';

/*
 * The render message type is duplicated so this Node-only service does not
 * import the browser-facing attachment-canvas package. Importing
 * `@epam/ai-dial-attachment-canvas` here would resolve to its built `dist`, so
 * the comparison would depend on whether the lib happens to be built — read
 * the lib's source constant instead.
 */
const LIB_CONSTANT_PATH = join(
  __dirname,
  '../../../../../libs/attachment-canvas/src/constants/html-preview.ts',
);

describe('HTML_PREVIEW_FRAME_RENDER_MESSAGE', () => {
  it('matches the constant @epam/ai-dial-attachment-canvas posts', () => {
    const source = readFileSync(LIB_CONSTANT_PATH, 'utf-8');
    const match = source.match(
      /export const HTML_PREVIEW_FRAME_RENDER_MESSAGE\s*=\s*'([^']+)'/,
    );

    expect(match?.[1]).toBe(HTML_PREVIEW_FRAME_RENDER_MESSAGE);
  });
});
