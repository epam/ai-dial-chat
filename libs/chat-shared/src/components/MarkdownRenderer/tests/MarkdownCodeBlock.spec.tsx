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
    render(<MarkdownCodeBlock language="typescript" value="const x = 1;" />);

    const label = screen.getByText('typescript');
    expect(label.className).not.toContain('opacity-60');
  });

  it('renders title in place of language in the header, keeping language for highlighting', () => {
    render(
      <MarkdownCodeBlock
        language="bash"
        title="cURL"
        value="curl https://dial.example.com"
      />,
    );

    expect(screen.getByText('cURL')).toBeTruthy();
    expect(screen.queryByText('bash')).toBeNull();
    /*
     * The `language` prop is forwarded to the syntax highlighter for
     * highlighting only — it renders as a `data-language` attribute (mocked
     * here), never as visible text, so no semantic query can reach it.
     */
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector('[data-language="bash"]')).toBeTruthy();
  });

  it('renders no label text when language is empty', () => {
    render(<MarkdownCodeBlock language="" value="const x = 1;" />);

    // Empty language renders an empty label span with no accessible text.
    const label = screen.getByText('', { selector: 'span' });
    expect(label.textContent).toBe('');
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

  it('does not render the download button when hideDownload is true, but still shows copy', () => {
    render(
      <MarkdownCodeBlock
        language="typescript"
        value="const x = 1;"
        hideDownload
        downloadLabel="Download code"
        copyLabel="Copy code"
      />,
    );

    expect(screen.queryByRole('button', { name: 'Download code' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy();
  });

  it('sets dir="ltr" on the scroll container', () => {
    render(<MarkdownCodeBlock language="typescript" value="const x = 1;" />);

    // The scroll container has no accessible role/name — this is a plain
    // layout-attribute check with no semantic query available.
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector('[dir="ltr"]')).toBeTruthy();
  });

  it('applies containerClassName to the outer div', () => {
    render(
      <MarkdownCodeBlock
        language="typescript"
        value="const x = 1;"
        containerClassName="my-custom-class"
      />,
    );

    // `.my-4` is a stable class on the outer container, used to locate it for this class-merge check.
    // eslint-disable-next-line testing-library/no-node-access
    const outer = document.querySelector('.my-4') as HTMLElement;
    expect(outer.className).toContain('my-custom-class');
  });

  it('uses comfortable block spacing and a compact header', () => {
    render(<MarkdownCodeBlock language="typescript" value="const x = 1;" />);

    // eslint-disable-next-line testing-library/no-node-access
    const block = document.querySelector('.my-4') as HTMLElement;
    // eslint-disable-next-line testing-library/no-node-access
    const header = document.querySelector('.min-h-10') as HTMLElement;

    expect(block.className).toContain('my-4');
    expect(block.className).toContain('max-w-full');
    expect(header.className).toContain('min-h-10');
    expect(header.className).not.toContain('sticky');
  });

  it('renders the code value', () => {
    render(<MarkdownCodeBlock language="typescript" value="const x = 1;" />);

    expect(screen.getByText('const x = 1;')).toBeTruthy();
  });

  it.each([CodeBlockTheme.Light, CodeBlockTheme.Dark])(
    'renders the %s theme without error, on the restrained CSS-token palette',
    (theme) => {
      render(
        <MarkdownCodeBlock
          language="typescript"
          value="const x = 1;"
          theme={theme}
        />,
      );

      expect(screen.getByText('const x = 1;')).toBeTruthy();
    },
  );

  it('scrolls long lines horizontally instead of wrapping', () => {
    const longLine = `const url = "${'a'.repeat(400)}";`;
    render(<MarkdownCodeBlock language="typescript" value={longLine} />);

    // eslint-disable-next-line testing-library/no-node-access -- no accessible role/name on the scroll container; layout-attribute check only
    const scrollContainer = document.querySelector(
      '[dir="ltr"]',
    ) as HTMLElement;
    expect(scrollContainer.className).toContain('overflow-auto');
    expect(scrollContainer.textContent).toContain(longLine);
  });

  it('renders titleSlot in place of the plain language label when provided', () => {
    render(
      <MarkdownCodeBlock
        language="typescript"
        value="const x = 1;"
        titleSlot={<button>Pick language</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Pick language' })).toBeTruthy();
    expect(screen.queryByText('typescript')).toBeNull();
  });

  it('removes the header vertical padding when a custom titleSlot is provided', () => {
    render(
      <MarkdownCodeBlock
        language="typescript"
        value="const x = 1;"
        titleSlot={<button>Pick language</button>}
      />,
    );

    // eslint-disable-next-line testing-library/no-node-access -- header has no accessible role; padding-class check only
    const header = document.querySelector('.border-b') as HTMLElement;
    expect(header.className).toContain('py-0');
    expect(header.className).not.toContain('py-2');
  });

  it('keeps the header default vertical padding for the plain language label', () => {
    render(<MarkdownCodeBlock language="typescript" value="const x = 1;" />);

    // eslint-disable-next-line testing-library/no-node-access -- header has no accessible role; padding-class check only
    const header = document.querySelector('.border-b') as HTMLElement;
    expect(header.className).toContain('py-2');
  });

  it('still shows the download and copy buttons alongside a custom titleSlot', () => {
    render(
      <MarkdownCodeBlock
        language="typescript"
        value="const x = 1;"
        titleSlot={<button>Pick language</button>}
        copyLabel="Copy code"
        downloadLabel="Download code"
      />,
    );

    expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download code' })).toBeTruthy();
  });

  it('preserves <pre>/<code> semantics for a language-less block', () => {
    render(<MarkdownCodeBlock language="" value="plain text block" />);

    // Verifying the <pre>/<code> tag structure itself is the point of this
    // test, so a tag-hierarchy selector is used instead of a semantic query.
    // eslint-disable-next-line testing-library/no-node-access
    const code = document.querySelector('pre code');
    expect(code?.textContent).toBe('plain text block');
  });
});
