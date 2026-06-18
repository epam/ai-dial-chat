import { copyToClipboard } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@epam/ai-dial-chat-shared', () => ({
  copyToClipboard: vi.fn(),
  mergeClasses: (...classes: (string | undefined | false | null)[]) =>
    classes.filter(Boolean).join(' '),
}));
vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children, language }: { children: string; language: string }) => (
    <pre data-language={language}>
      <code>{children}</code>
    </pre>
  ),
}));
vi.mock('react-syntax-highlighter/dist/cjs/styles/prism', () => ({
  oneDark: {},
  oneLight: {},
}));
import { MarkdownCodeBlock } from '../MarkdownCodeBlock';

describe('MarkdownCodeBlock', () => {
  beforeEach(() => {
    vi.mocked(copyToClipboard).mockResolvedValue(true);
  });

  it('renders the language label when language is non-empty', () => {
    render(<MarkdownCodeBlock language="typescript" value="const x = 1;" />);

    expect(screen.getByText('typescript')).toBeTruthy();
  });

  it('renders no label text when language is empty', () => {
    const { container } = render(
      <MarkdownCodeBlock language="" value="const x = 1;" />,
    );

    const labelSpan = container.querySelector('span.opacity-60');
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

  it('switches aria-label to copiedLabel after clicking copy', async () => {
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

    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeTruthy();
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

  it('renders the code value', () => {
    const { container } = render(
      <MarkdownCodeBlock language="typescript" value="const x = 1;" />,
    );

    expect(container.querySelector('code')?.textContent).toContain(
      'const x = 1;',
    );
  });
});
