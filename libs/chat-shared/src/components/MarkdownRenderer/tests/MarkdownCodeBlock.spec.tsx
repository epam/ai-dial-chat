import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeBlockTheme } from '../../../types/code-editor';
import { copyToClipboard } from '../../../utils/copy-to-clipboard';
import { downloadTextFile } from '../../../utils/file-download';
import { MarkdownCodeBlock } from '../CodeBlock/CodeBlock';

vi.mock('../../../utils/copy-to-clipboard', () => ({
  copyToClipboard: vi.fn(),
}));
vi.mock('../../../utils/file-download', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../utils/file-download')>();
  return { ...actual, downloadTextFile: vi.fn() };
});
vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children, language }: { children: string; language: string }) => (
    <pre data-language={language}>
      <code>{children}</code>
    </pre>
  ),
}));

describe('MarkdownCodeBlock', () => {
  beforeEach(() => {
    vi.mocked(copyToClipboard).mockResolvedValue(true);
    vi.mocked(downloadTextFile).mockClear();
  });

  it('renders the language label as a small uppercase muted caption', () => {
    const { container } = render(
      <MarkdownCodeBlock language="typescript" value="const x = 1;" />,
    );

    const label = screen.getByText('typescript');
    expect(label.className).toContain('uppercase');
    expect(container.querySelector('span.opacity-60')).toBeNull();
  });

  it('renders no label text when language is empty', () => {
    const { container } = render(
      <MarkdownCodeBlock language="" value="const x = 1;" />,
    );

    const labelSpan = container.querySelector('span.uppercase');
    expect(labelSpan?.textContent).toBe('');
  });

  it('renders the copy button when isStreaming is false', () => {
    render(
      <MarkdownCodeBlock
        language="typescript"
        value="const x = 1;"
        isStreaming={false}
        copyLabel="Copy code"
      />,
    );

    expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy();
  });

  it('does not render the copy button when isStreaming is true', () => {
    render(
      <MarkdownCodeBlock
        language="typescript"
        value="const x = 1;"
        isStreaming={true}
        copyLabel="Copy code"
      />,
    );

    expect(screen.queryByRole('button', { name: 'Copy code' })).toBeNull();
  });

  it('renders the copy button as icon-only, with no visible text label', () => {
    render(
      <MarkdownCodeBlock
        language="typescript"
        value="const x = 1;"
        copyLabel="Copy code"
      />,
    );

    const copyButton = screen.getByRole('button', { name: 'Copy code' });
    expect(copyButton.textContent).toBe('');
  });

  it('shows a Copied confirm state — writes the clipboard, swaps the icon and accessible name, and tints the button green', async () => {
    const user = userEvent.setup({ delay: null });

    render(
      <MarkdownCodeBlock
        language="typescript"
        value="const x = 1;"
        copyLabel="Copy code"
        copiedLabel="Copied!"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Copy code' }));

    expect(copyToClipboard).toHaveBeenCalledWith('const x = 1;');
    const copiedButton = await screen.findByRole('button', {
      name: 'Copied!',
    });
    expect(copiedButton.className).toContain('dial-kit-primary-ghost-button');
  });

  it('renders a download button next to copy that downloads the code as a file', async () => {
    const user = userEvent.setup({ delay: null });

    render(
      <MarkdownCodeBlock
        language="typescript"
        value="const x = 1;"
        downloadLabel="Download code"
      />,
    );

    const downloadButton = screen.getByRole('button', {
      name: 'Download code',
    });
    await user.click(downloadButton);

    expect(downloadTextFile).toHaveBeenCalledWith('const x = 1;', 'code.ts');
  });

  it('does not render the download button when isStreaming is true', () => {
    render(
      <MarkdownCodeBlock
        language="typescript"
        value="const x = 1;"
        isStreaming={true}
        downloadLabel="Download code"
      />,
    );

    expect(screen.queryByRole('button', { name: 'Download code' })).toBeNull();
  });

  it('sets dir="ltr" on the scroll container', () => {
    const { container } = render(
      <MarkdownCodeBlock language="typescript" value="const x = 1;" />,
    );

    expect(container.querySelector('[dir="ltr"]')).toBeTruthy();
  });

  it('applies containerClassName to the outer div', () => {
    const { container } = render(
      <MarkdownCodeBlock
        language="typescript"
        value="const x = 1;"
        containerClassName="my-custom-class"
      />,
    );

    expect((container.firstChild as HTMLElement)?.className).toContain(
      'my-custom-class',
    );
  });

  it('uses comfortable block spacing and a compact header', () => {
    const { container } = render(
      <MarkdownCodeBlock language="typescript" value="const x = 1;" />,
    );

    const block = container.firstChild as HTMLElement;
    const header = block.firstChild as HTMLElement;

    expect(block.className).toContain('my-4');
    expect(block.className).toContain('max-w-full');
    expect(header.className).toContain('min-h-10');
    expect(header.className).not.toContain('sticky');
  });

  it('renders the code value', () => {
    const { container } = render(
      <MarkdownCodeBlock language="typescript" value="const x = 1;" />,
    );

    expect(container.querySelector('code')?.textContent).toContain(
      'const x = 1;',
    );
  });

  it.each([CodeBlockTheme.Light, CodeBlockTheme.Dark])(
    'renders the %s theme without error, on the restrained CSS-token palette',
    (theme) => {
      const { container } = render(
        <MarkdownCodeBlock
          language="typescript"
          value="const x = 1;"
          theme={theme}
        />,
      );

      expect(container.querySelector('code')?.textContent).toContain(
        'const x = 1;',
      );
    },
  );

  it('scrolls long lines horizontally instead of wrapping', () => {
    const longLine = `const url = "${'a'.repeat(400)}";`;
    const { container } = render(
      <MarkdownCodeBlock language="typescript" value={longLine} />,
    );

    const scrollContainer = container.querySelector(
      '[dir="ltr"]',
    ) as HTMLElement;
    expect(scrollContainer.className).toContain('overflow-auto');
    expect(scrollContainer.textContent).toContain(longLine);
  });

  it('preserves <pre>/<code> semantics for a language-less block', () => {
    const { container } = render(
      <MarkdownCodeBlock language="" value="plain text block" />,
    );

    const pre = container.querySelector('pre');
    expect(pre?.querySelector('code')?.textContent).toBe('plain text block');
  });
});
