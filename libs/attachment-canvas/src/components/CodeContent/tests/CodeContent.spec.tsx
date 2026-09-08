import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentContentType } from '../../../types/attachment-canvas';
import { CodeContent } from '../CodeContent';

vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children, language }: { children: string; language: string }) => (
    <pre data-language={language}>
      <code>{children}</code>
    </pre>
  ),
}));

describe('CodeContent', () => {
  it('renders plain text immediately with no syntax highlighter for a plaintext language', () => {
    render(
      <CodeContent
        content={{
          type: AttachmentContentType.Code,
          text: 'console.log(1)',
          language: 'plaintext',
        }}
      />,
    );

    expect(screen.getByText('console.log(1)')).toBeTruthy();
    // eslint-disable-next-line testing-library/no-node-access -- the mocked Prism output carries this attribute; its absence confirms the highlighter never loaded
    expect(document.querySelector('[data-language]')).toBeNull();
  });

  it('renders plain text immediately with no syntax highlighter when no language is set', () => {
    render(
      <CodeContent
        content={{ type: AttachmentContentType.Code, text: 'console.log(1)' }}
      />,
    );

    expect(screen.getByText('console.log(1)')).toBeTruthy();
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector('[data-language]')).toBeNull();
  });

  it('shows the value via a plain fallback, then highlights it once the engine loads for a real language', async () => {
    render(
      <CodeContent
        content={{
          type: AttachmentContentType.Code,
          text: 'const x = 1;',
          language: 'typescript',
        }}
      />,
    );

    expect(screen.getByText('const x = 1;')).toBeTruthy();

    await waitFor(() => {
      // eslint-disable-next-line testing-library/no-node-access -- mocked Prism output has no accessible role
      const highlighted = document.querySelector(
        '[data-language="typescript"]',
      );
      expect(highlighted).toBeTruthy();
    });
  });

  it('announces the pending state via role="status" while keeping the plain-text fallback visible', async () => {
    render(
      <CodeContent
        content={{
          type: AttachmentContentType.Code,
          text: 'const x = 1;',
          language: 'typescript',
        }}
        labels={{ loadingLabel: 'Loading syntax highlighting…' }}
      />,
    );

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('const x = 1;')).toBeTruthy();
    expect(screen.getByText('Loading syntax highlighting…')).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });
  });
});
