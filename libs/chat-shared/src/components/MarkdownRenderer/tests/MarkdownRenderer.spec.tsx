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

const INDENTED_TEXT_MARKDOWN = `Summary:

    first indented line
    second indented line

Done.`;

const EXTENDED_MARKDOWN = `#### Smaller heading

---

- [x] Completed

~~Removed~~`;

describe('MarkdownRenderer', () => {
  it('renders GFM tables in a horizontally scrollable container', () => {
    render(<MarkdownRenderer content={TABLE_MARKDOWN} />);

    const table = screen.getByRole('table');
    const scrollContainer = table.parentElement;
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
    expect(columnHeader.className).toContain('uppercase');
  });

  it('applies a shared row class to every row for zebra/hover styling', () => {
    render(<MarkdownRenderer content={TABLE_MARKDOWN} />);

    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(2);
    rows.forEach((row) => expect(row.className).toContain('row'));
  });

  it('detects a section row (single non-empty cell) without misdetecting normal rows', () => {
    render(<MarkdownRenderer content={SECTION_ROW_MARKDOWN} />);

    const sectionCell = screen.getByRole('cell', { name: 'Group B' });
    const sectionRow = sectionCell.closest('tr');
    expect(sectionRow?.className).toContain('sectionRow');

    const normalCell = screen.getByRole('cell', { name: 'Alpha' });
    const normalRow = normalCell.closest('tr');
    expect(normalRow?.className).not.toContain('sectionRow');

    const headerRow = screen
      .getByRole('columnheader', { name: 'Name' })
      .closest('tr');
    expect(headerRow?.className).not.toContain('sectionRow');
  });

  it('renders a header-only table (no body rows) without error', () => {
    render(<MarkdownRenderer content={EMPTY_TABLE_MARKDOWN} />);

    const table = screen.getByRole('table');
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeTruthy();
    expect(table.querySelector('tbody')?.children.length ?? 0).toBe(0);
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

    expect(table.parentElement?.parentElement?.className).toContain(
      'custom-wrapper',
    );
    expect(columnHeader.className).toContain('custom-cell');
    expect(columnHeader.className).toContain('custom-header');
    expect(cell.className).toContain('custom-cell');
    expect(columnHeader.className).toContain('max-w-96');
    expect(columnHeader.className).toContain('whitespace-normal');
    expect(columnHeader.className).toContain('border-b');
    expect(columnHeader.className).toContain('text-secondary');
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

  it('renders a fenced block without language: no label text, copy button present', () => {
    const { container } = render(
      <MarkdownRenderer
        content={FENCED_NO_LANG_MARKDOWN}
        codeBlockCopyLabel="Copy code"
      />,
    );

    const labelSpan = container.querySelector('span.uppercase');
    expect(labelSpan?.textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy();
  });

  it('renders inline `code` as a <code> element without a header', () => {
    render(<MarkdownRenderer content="Use `const` here." />);

    const codeEl = screen.getByText('const');
    expect(codeEl.tagName).toBe('CODE');
    expect(codeEl.closest('[class*="sticky"]')).toBeNull();
  });

  it('renders indented text without backticks as plain markdown text', () => {
    const { container } = render(
      <MarkdownRenderer
        content={INDENTED_TEXT_MARKDOWN}
        codeBlockCopyLabel="Copy code"
      />,
    );

    expect(container.querySelector('pre')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy code' })).toBeNull();
    expect(container.textContent).toContain('first indented line');
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
    const { container } = render(
      <MarkdownRenderer
        content={FENCED_TS_MARKDOWN}
        classNames={{ codeBlockContainer: 'custom-container' }}
      />,
    );

    expect(container.querySelector('.custom-container')).toBeTruthy();
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
    expect(document.querySelector('hr')?.className).toContain('custom-hr');
    expect(screen.getByText('Removed').className).toContain('custom-del');
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(checkbox.getAttribute('aria-disabled')).toBe('true');
  });
});
