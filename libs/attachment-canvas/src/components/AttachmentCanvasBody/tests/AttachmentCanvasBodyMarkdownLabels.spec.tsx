import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttachmentContentType } from '../../../types/attachment-canvas';
import { AttachmentCanvasBody } from '../AttachmentCanvasBody';

/* Uses the real `MarkdownRenderer` (the main spec mocks it) so the assertion
 * covers the whole chain down to the rendered code-block buttons. */
describe('AttachmentCanvasBody markdown code-block labels', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('names the code-block copy and download buttons with the host labels', () => {
    render(
      <AttachmentCanvasBody
        content={{
          type: AttachmentContentType.Markdown,
          text: '```ts\nconst a = 1;\n```',
        }}
        labels={{
          codeBlockCopyLabel: 'Kopieren',
          codeBlockDownloadLabel: 'Herunterladen',
        }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Kopieren' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Herunterladen' })).toBeTruthy();
  });

  it('names an overflowing table scroll region with the host label', () => {
    /* jsdom has no layout; report a table wider than its scroll container. */
    vi.spyOn(HTMLDivElement.prototype, 'scrollWidth', 'get').mockReturnValue(
      400,
    );
    vi.spyOn(HTMLDivElement.prototype, 'clientWidth', 'get').mockReturnValue(
      200,
    );
    vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockReturnValue(
      { left: 0, right: 200 } as DOMRect,
    );
    vi.spyOn(
      HTMLTableElement.prototype,
      'getBoundingClientRect',
    ).mockReturnValue({ left: 0, right: 400 } as DOMRect);

    render(
      <AttachmentCanvasBody
        content={{
          type: AttachmentContentType.Markdown,
          text: '| a | b |\n| - | - |\n| 1 | 2 |',
        }}
        labels={{ tableScrollRegionAriaLabel: 'Scrollbare Tabelle' }}
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Scrollbare Tabelle' }),
    ).toBeTruthy();
  });
});
