import { act, render, screen, waitFor } from '@testing-library/react';
import { Prism } from 'react-syntax-highlighter';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttachmentContentType } from '../../../types/attachment-canvas';
import { CodeContent } from '../CodeContent';

vi.mock('react-syntax-highlighter', () => ({
  Prism: vi.fn(
    ({ children, language }: { children: string; language: string }) => (
      <pre data-language={language}>
        <code>{children}</code>
      </pre>
    ),
  ),
}));

describe('CodeContent', () => {
  beforeEach(() => {
    vi.mocked(Prism).mockClear();
  });

  it.each([
    ['markdown', 'x'.repeat(2_001)],
    ['json', `${'x'.repeat(999)}\n`.repeat(51)],
    ['markdown', JSON.stringify({ contentBytes: 'A'.repeat(175_052) })],
  ])(
    'preserves oversized %s attachments without invoking Prism',
    async (language, text) => {
      render(
        <CodeContent
          content={{ type: AttachmentContentType.Code, language, text }}
        />,
      );
      await act(() => Promise.resolve());

      expect(Prism).not.toHaveBeenCalled();
      expect(
        screen.getByText(text, { exact: true, normalizer: (value) => value })
          .textContent,
      ).toBe(text);
      expect(screen.queryByRole('status')).toBeNull();
    },
  );

  it('rechecks eligibility when switching between small and oversized attachments', async () => {
    const content = {
      type: AttachmentContentType.Code as const,
      language: 'markdown',
      text: '# Small',
    };
    const { rerender } = render(<CodeContent content={content} />);
    await waitFor(() => expect(Prism).toHaveBeenCalled());
    vi.mocked(Prism).mockClear();

    rerender(<CodeContent content={{ ...content, text: 'x'.repeat(2_001) }} />);
    await act(() => Promise.resolve());
    expect(Prism).not.toHaveBeenCalled();

    rerender(<CodeContent content={{ ...content, text: '# Small again' }} />);
    await waitFor(() => expect(Prism).toHaveBeenCalled());
    expect(screen.getByText('# Small again')).toBeTruthy();
  });
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
