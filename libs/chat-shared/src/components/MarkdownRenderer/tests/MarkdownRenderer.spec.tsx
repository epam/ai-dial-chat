import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownRenderer } from '../MarkdownRenderer';

vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children, language }: { children: string; language: string }) => (
    <pre data-language={language}>
      <code>{children}</code>
    </pre>
  ),
}));

const TABLE_MARKDOWN = `| Name | Description |
| --- | --- |
| Alpha | A long table value |`;

const SECTION_ROW_MARKDOWN = `| Name | Description |
| --- | --- |
| Alpha | A long table value |
| Group B |  |
| Beta | Another value |`;

const EMPTY_TABLE_MARKDOWN = `| Name | Description |
| --- | --- |`;

const FENCED_TS_MARKDOWN = `\`\`\`typescript
const x = 1;
\`\`\``;

const FENCED_NO_LANG_MARKDOWN = `\`\`\`
plain code
\`\`\``;

const EXTENDED_MARKDOWN = `#### Smaller heading

---

- [x] Completed

~~Removed~~`;

const POEM_MARKDOWN = 'Line one\nLine two\nLine three';

const TWO_PARAGRAPHS_MARKDOWN = 'Paragraph one.\n\nParagraph two.';

const LIST_MARKDOWN = '- Item one\n- Item two\n- Item three';

describe('MarkdownRenderer', () => {
  it('renders GFM tables in a horizontally scrollable container', () => {
    render(<MarkdownRenderer content={TABLE_MARKDOWN} />);

    const table = screen.getByRole('table');
    /*
     * The scroll container and outer wrapper are plain divs with no
     * accessible role — ancestor traversal from the semantic <table> is the
     * only way to reach them for these CSS-level class checks.
     */
    // eslint-disable-next-line testing-library/no-node-access
    const scrollContainer = table.parentElement;
    // eslint-disable-next-line testing-library/no-node-access
    const tableWrapper = scrollContainer?.parentElement;

    expect(table.className).toContain('w-max');
    expect(table.className).toContain('min-w-full');
    expect(tableWrapper?.className).toContain('max-w-full');
    expect(tableWrapper?.className).toContain('min-w-0');
    expect(tableWrapper?.className).toContain('overflow-hidden');
    expect(tableWrapper?.className).toContain('rounded-xl');
    expect(tableWrapper?.className).toContain('border');
    expect(scrollContainer?.className).toContain('overflow-x-auto');
  });

  it('marks column headers with scope="col" and sticky uppercase styling', () => {
    render(<MarkdownRenderer content={TABLE_MARKDOWN} />);

    const columnHeader = screen.getByRole('columnheader', { name: 'Name' });
    expect(columnHeader.getAttribute('scope')).toBe('col');
    expect(columnHeader.className).toContain('sticky');
  });

  it('applies a shared row class to every row for zebra/hover styling', () => {
    render(<MarkdownRenderer content={TABLE_MARKDOWN} />);

    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(2);
    rows.forEach((row) => expect(row.className).toContain('row'));
  });

  it('detects a section row (single non-empty cell) without misdetecting normal rows', () => {
    render(<MarkdownRenderer content={SECTION_ROW_MARKDOWN} />);

    // Rows carry the implicit "row" role, so each row under test is found
    // by its text content rather than by traversing up from a cell.
    const findRow = (text: string) =>
      screen.getAllByRole('row').find((row) => row.textContent?.includes(text));

    expect(findRow('Group B')?.className).toContain('sectionRow');
    expect(findRow('Alpha')?.className).not.toContain('sectionRow');
    expect(findRow('Name')?.className).not.toContain('sectionRow');
  });

  it('renders a header-only table (no body rows) without error', () => {
    render(<MarkdownRenderer content={EMPTY_TABLE_MARKDOWN} />);

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeTruthy();
    // Only the header row exists — no body rows were rendered.
    expect(screen.getAllByRole('row')).toHaveLength(1);
  });

  it('merges table class overrides with the scrolling defaults', () => {
    render(
      <MarkdownRenderer
        content={TABLE_MARKDOWN}
        classNames={{
          tableWrapper: 'custom-wrapper',
          tableCell: 'custom-cell',
          tableHeader: 'custom-header',
          tableBodyCell: 'custom-body-cell',
        }}
      />,
    );

    const table = screen.getByRole('table');
    const columnHeader = screen.getByRole('columnheader', { name: 'Name' });
    const cell = screen.getByRole('cell', { name: 'Alpha' });

    // The outer wrapper div carrying `tableWrapper` has no accessible role.
    expect(table.parentElement?.parentElement?.className).toContain(
      'custom-wrapper',
    );
    expect(columnHeader.className).toContain('custom-cell');
    expect(columnHeader.className).toContain('custom-header');
    expect(cell.className).toContain('custom-cell');
    expect(columnHeader.className).toContain('max-w-96');
    expect(columnHeader.className).toContain('whitespace-normal');
    expect(columnHeader.className).toContain('border-b');
    expect(columnHeader.className).toContain('tableHeaderCell');
    expect(cell.className).toContain('max-w-96');
    expect(cell.className).toContain('border-b');
    expect(cell.className).toContain('align-top');
    expect(cell.className).toContain('custom-body-cell');
    expect(columnHeader.className).not.toContain('custom-body-cell');
  });

  it('renders a fenced TypeScript block with language label and copy button', () => {
    render(
      <MarkdownRenderer
        content={FENCED_TS_MARKDOWN}
        codeBlockCopyLabel="Copy code"
      />,
    );

    expect(screen.getByText('typescript')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy();
  });

  it('renders inline `code` as a <code> element without a header', () => {
    render(<MarkdownRenderer content="Use `const` here." />);

    const codeEl = screen.getByText('const');
    expect(codeEl.tagName).toBe('CODE');
    // No sticky-positioned header ancestor exists for inline code, and there
    // is no semantic role to assert that absence with.
    // eslint-disable-next-line testing-library/no-node-access
    expect(codeEl.closest('[class*="sticky"]')).toBeNull();
  });

  it('hides the copy button when isStreaming is true', () => {
    render(
      <MarkdownRenderer
        content={FENCED_TS_MARKDOWN}
        isStreaming={true}
        codeBlockCopyLabel="Copy code"
      />,
    );

    expect(screen.queryByRole('button', { name: 'Copy code' })).toBeNull();
  });

  it('passes codeBlockCopyLabel to the copy button accessible label', () => {
    render(
      <MarkdownRenderer
        content={FENCED_TS_MARKDOWN}
        codeBlockCopyLabel="Custom copy label"
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Custom copy label' }),
    ).toBeTruthy();
  });

  it('applies classNames.codeBlockContainer to the block container', () => {
    render(
      <MarkdownRenderer
        content={FENCED_TS_MARKDOWN}
        classNames={{ codeBlockContainer: 'custom-container' }}
      />,
    );

    // The code block container has no accessible role of its own.
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector('.custom-container')).toBeTruthy();
  });

  it('styles extended GFM prose elements', () => {
    render(
      <MarkdownRenderer
        content={EXTENDED_MARKDOWN}
        classNames={{
          h4: 'custom-h4',
          hr: 'custom-hr',
          del: 'custom-del',
        }}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 4, name: 'Smaller heading' })
        .className,
    ).toContain('custom-h4');
    expect(screen.getByRole('separator').className).toContain('custom-hr');
    expect(screen.getByText('Removed').className).toContain('custom-del');
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(checkbox.getAttribute('aria-disabled')).toBe('true');
  });

  it('renders single-newline-separated lines with a visible line break between each pair', () => {
    render(<MarkdownRenderer content={POEM_MARKDOWN} />);

    /*
     * The paragraph and its <br> line breaks carry no accessible role, so
     * this line-break/ordering check needs direct DOM access. Querying
     * `document` (rather than destructuring `container` from `render`)
     * keeps the render call itself free of unused bindings.
     */
    // eslint-disable-next-line testing-library/no-node-access
    const paragraph = document.querySelector('p');
    const text = paragraph?.textContent ?? '';
    expect(text).toContain('Line one');
    expect(text).toContain('Line two');
    expect(text).toContain('Line three');
    expect(text.indexOf('Line one')).toBeLessThan(text.indexOf('Line two'));
    expect(text.indexOf('Line two')).toBeLessThan(text.indexOf('Line three'));
    // eslint-disable-next-line testing-library/no-node-access
    expect(paragraph?.querySelectorAll('br').length).toBe(2);
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelectorAll('br').length).toBe(2);
  });

  it('keeps blank-line-separated paragraphs as two distinct <p> elements with no extra break inside either', () => {
    render(<MarkdownRenderer content={TWO_PARAGRAPHS_MARKDOWN} />);

    const firstParagraph = screen.getByText('Paragraph one.');
    const secondParagraph = screen.getByText('Paragraph two.');
    expect(firstParagraph.tagName).toBe('P');
    expect(secondParagraph.tagName).toBe('P');
    expect(firstParagraph).not.toBe(secondParagraph);
    // <br> has no accessible role, so its absence is checked via querySelectorAll.
    // eslint-disable-next-line testing-library/no-node-access
    expect(firstParagraph.querySelectorAll('br').length).toBe(0);
    // eslint-disable-next-line testing-library/no-node-access
    expect(secondParagraph.querySelectorAll('br').length).toBe(0);
  });

  it('renders a list as list items rather than line-broken plain text', () => {
    render(<MarkdownRenderer content={LIST_MARKDOWN} />);

    const list = screen.getByRole('list');
    const items = screen.getAllByRole('listitem');
    // <br> has no accessible role, so its absence is checked via querySelectorAll.
    // eslint-disable-next-line testing-library/no-node-access
    expect(list.querySelectorAll('br').length).toBe(0);
    expect(items.map((item) => item.textContent)).toEqual([
      'Item one',
      'Item two',
      'Item three',
    ]);
  });

  it('does not inject extra line breaks inside a fenced code block with internal newlines', () => {
    render(<MarkdownRenderer content={FENCED_NO_LANG_MARKDOWN} />);

    // Neither <pre> nor <br> carries an accessible role.
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector('pre')?.querySelectorAll('br').length).toBe(
      0,
    );
  });

  it('renders an inline code span with no newline unaffected by break handling', () => {
    render(<MarkdownRenderer content="Use `const x = 1;` here" />);

    const codeEl = screen.getByText('const x = 1;');
    expect(codeEl.tagName).toBe('CODE');
    // <br> has no accessible role, so its absence is checked via querySelectorAll.
    // eslint-disable-next-line testing-library/no-node-access
    expect(codeEl.querySelectorAll('br').length).toBe(0);
  });

  it('renders double-dollar LaTeX as a KaTeX math element', () => {
    render(<MarkdownRenderer content="Equation: $$x^2 + y^2 = z^2$$" />);

    /*
     * MathML's `<math>` element crashes `getByRole` under jsdom (jsdom
     * cannot compute styles for MathML elements), so a plain selector is
     * the only reliable way to assert its presence here.
     */
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector('math')).toBeTruthy();
  });

  it('renders single-dollar inline LaTeX as a KaTeX math element', () => {
    render(<MarkdownRenderer content="Cost: $x + y$" />);

    // eslint-disable-next-line testing-library/no-node-access -- see note above: getByRole('math') crashes under jsdom
    expect(document.querySelector('math')).toBeTruthy();
  });

  it('lets a long unbreakable URL wrap so a clipped ancestor cannot cut it off', () => {
    const longUrl =
      'https://example.com/very/long/path/segment/that/never/breaks/document-name-with-no-spaces.pdf';
    render(<MarkdownRenderer content={`See ${longUrl} for details.`} />);

    // The paragraph wrapping the link has no accessible role of its own.
    // eslint-disable-next-line testing-library/no-node-access
    const paragraph = document.querySelector('p');
    const link = screen.getByRole('link');

    expect(paragraph?.className).toContain('break-words');
    expect(link.className).toContain('break-words');
    expect(link.getAttribute('href')).toBe(longUrl);
  });

  it('does not treat a currency amount as LaTeX', () => {
    render(<MarkdownRenderer content="Price is $50 and $100" />);

    // eslint-disable-next-line testing-library/no-node-access -- see note above: getByRole('math') crashes under jsdom
    expect(document.querySelector('math')).toBeNull();
    expect(screen.getByText('Price is $50 and $100')).toBeTruthy();
  });

  /* `\(...\)`/`\[...\]` (the LLM-style delimiters preprocessLaTeX deliberately leaves untouched,
   * see latex.spec.ts) only render as math once micromark-extension-math is aliased to
   * micromark-extension-llm-math in the consuming app's bundler config. Vitest's SSR module
   * resolution does not apply bundler-level resolve.alias to imports made from *inside* an
   * npm package (remark-math's own import of micromark-extension-math), so this can't be
   * asserted through this component test even though a real `vite build` picks up the alias
   * correctly (verified manually: the built dist bundle contains the aliased extension). */
});
