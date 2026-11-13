import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AttachmentCanvasContent } from '../../../models/attachment-canvas';
import { AttachmentContentType } from '../../../types/attachment-canvas';
import { AttachmentCanvasBody } from '../AttachmentCanvasBody';

/* The factory runs only when the module is first imported, so its counter
 * proves whether `AttachmentCanvasBody` imported the renderer at all. */
const rendererModule = vi.hoisted(() => ({ importCount: 0 }));

vi.mock('../../McpAppCanvasRenderer/McpAppCanvasRenderer', () => {
  rendererModule.importCount += 1;
  return {
    McpAppCanvasRenderer: ({ content }: { content: { html: string } }) => (
      <section aria-label="mcp-app">{content.html}</section>
    ),
  };
});

const mcpAppContent = {
  type: AttachmentContentType.McpApp,
  html: '<p>app</p>',
  sandboxUrl: 'https://sandbox.example/',
  onToolCall: vi.fn(),
} as unknown as AttachmentCanvasContent;

describe('AttachmentCanvasBody — MCP App renderer loading', () => {
  it('does not import the MCP App renderer for other content', () => {
    render(
      <AttachmentCanvasBody
        content={{ type: AttachmentContentType.PlainText, text: 'plain' }}
      />,
    );

    expect(screen.getByText('plain')).toBeTruthy();
    expect(rendererModule.importCount).toBe(0);
  });

  it('imports and renders the MCP App renderer lazily for McpApp content', async () => {
    render(<AttachmentCanvasBody content={mcpAppContent} />);

    expect(await screen.findByRole('region', { name: 'mcp-app' })).toBeTruthy();
    expect(rendererModule.importCount).toBe(1);
  });
});
