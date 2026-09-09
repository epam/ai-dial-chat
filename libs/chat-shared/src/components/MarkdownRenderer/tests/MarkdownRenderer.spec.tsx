import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

const TABLE_ACTION_LABELS = {
  copyCsvLabel: 'Copy as CSV',
  copyTxtLabel: 'Copy as TXT',
  copyMarkdownLabel: 'Copy as Markdown',
  copiedLabel: 'Copied!',
  downloadCsvLabel: 'Download as CSV',
};

const ALIGNED_TABLE_MARKDOWN = `| Right | Plain | Left | Center |
| ---: | --- | :--- | :---: |
| 1 | 2 | 3 | 4 |`;

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

/* Runs past nine so the markers that overflowed a too-narrow start padding
   (issue #8655) are the ones under test. */
const ORDERED_LIST_MARKDOWN = Array.from(
  { length: 17 },
  (_, index) => `${index + 1}. Item ${index + 1}`,
).join('\n');

const DISPLAY_MATH_MARKDOWN = `Einstein's field equations:

$$
R_{\\mu\\nu} - \\frac{1}{2}g_{\\mu\\nu}R + \\Lambda g_{\\mu\\nu} = \\frac{8\\pi G}{c^4}T_{\\mu\\nu}
$$`;

describe('MarkdownRenderer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it('renders table actions when table action labels are supplied', () => {
    render(
      <MarkdownRenderer
        content={TABLE_MARKDOWN}
        tableActionLabels={TABLE_ACTION_LABELS}
        tableDownloadFilename="report.csv"
      />,
    );

    expect(screen.getByRole('button', { name: 'Copy as CSV' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy as TXT' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Copy as Markdown' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Download as CSV' }),
    ).toBeTruthy();
  });

  it('renders tables without actions when table action labels are absent', () => {
    render(<MarkdownRenderer content={TABLE_MARKDOWN} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('forwards tableOnOpenInCanvas to the table, calling it with the serialized Markdown', async () => {
    /* The action button's Tooltip mounts via floating-ui, which requires
     * IntersectionObserver — absent by default in jsdom. */
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {
          // No-op in JSDOM.
        }
        unobserve() {
          // No-op in JSDOM.
        }
        disconnect() {
          // No-op in JSDOM.
        }
      },
    );

    const user = userEvent.setup({ delay: null });
    const tableOnOpenInCanvas = vi.fn();
    render(
      <MarkdownRenderer
        content={TABLE_MARKDOWN}
        tableActionLabels={{
          ...TABLE_ACTION_LABELS,
          openInCanvasLabel: 'Open in canvas',
        }}
        tableOnOpenInCanvas={tableOnOpenInCanvas}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Open in canvas' }));

    expect(tableOnOpenInCanvas).toHaveBeenCalledWith(
      '| Name | Description |\n| :-- | :-- |\n| Alpha | A long table value |',
    );
  });

  it('does not render Open in Canvas when tableOnOpenInCanvas is absent', () => {
    render(
      <MarkdownRenderer
        content={TABLE_MARKDOWN}
        tableActionLabels={{
          ...TABLE_ACTION_LABELS,
          openInCanvasLabel: 'Open in canvas',
        }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Open in canvas' })).toBeNull();
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

  it('applies GFM column alignment to header and body cells', () => {
    render(<MarkdownRenderer content={ALIGNED_TABLE_MARKDOWN} />);

    const alignmentByColumn = [
      { header: 'Right', cell: '1', expected: 'text-end' },
      { header: 'Left', cell: '3', expected: 'text-start' },
      { header: 'Center', cell: '4', expected: 'text-center' },
    ];

    alignmentByColumn.forEach(({ header, cell, expected }) => {
      const columnHeader = screen.getByRole('columnheader', { name: header });
      const bodyCell = screen.getByRole('cell', { name: cell });

      expect(columnHeader.className).toContain(expected);
      expect(bodyCell.className).toContain(expected);
    });

    /* An explicit alignment replaces the header default rather than stacking
       on it, and an unaligned column keeps the inherited start alignment. */
    expect(
      screen.getByRole('columnheader', { name: 'Center' }).className,
    ).not.toContain('text-start');
    expect(
      screen.getByRole('columnheader', { name: 'Plain' }).className,
    ).toContain('text-start');
    expect(screen.getByRole('cell', { name: '2' }).className).not.toMatch(
      /text-(start|center|end)/,
    );
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
    expect(columnHeader.className).toContain('rowDivider');
    expect(columnHeader.className).toContain('tableHeaderCell');
    expect(cell.className).toContain('max-w-96');
    expect(cell.className).toContain('rowDivider');
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
    expect(checkbox.disabled).toBe(true);
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

  it('renders a literal <br> tag in the source as a real line break', () => {
    render(<MarkdownRenderer content="Line one <br>Line two" />);

    // <br> has no accessible role, so this needs direct DOM access.
    // eslint-disable-next-line testing-library/no-node-access
    const paragraph = document.querySelector('p');
    // eslint-disable-next-line testing-library/no-node-access
    expect(paragraph?.querySelectorAll('br').length).toBe(1);
    expect(paragraph?.textContent).not.toContain('<br>');
  });

  it('renders a <cit data-id> element as literal text by default', () => {
    render(
      <MarkdownRenderer content='Patient meets criteria<cit data-id="e1"></cit>.' />,
    );

    expect(
      screen.getByText('Patient meets criteria<cit data-id="e1"></cit>.'),
    ).toBeTruthy();
  });

  it('lets a host-supplied components.cit override render the element', () => {
    render(
      <MarkdownRenderer
        content='Patient meets criteria<cit data-id="e1"></cit>.'
        components={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...({ cit: () => <span>[1]</span> } as any),
        }}
      />,
    );

    expect(screen.getByText('[1]')).toBeTruthy();
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

  it('gives lists start padding wide enough for a multi-digit marker', () => {
    const { rerender } = render(<MarkdownRenderer content={LIST_MARKDOWN} />);

    /* An `outside` marker is painted in this padding — too little and a
       two-digit `17.` is clipped by whichever ancestor scrolls. The value is
       in `em` so it tracks the font size the host sets. */
    expect(screen.getByRole('list').className).toContain('ps-[2em]');

    rerender(<MarkdownRenderer content={ORDERED_LIST_MARKDOWN} />);

    const orderedList = screen.getByRole('list');
    expect(orderedList.className).toContain('ps-[2em]');
    expect(orderedList.className).toContain('list-decimal');
    // Both list kinds share the indent, so a document mixing them stays aligned.
    expect(orderedList.className).not.toContain('ps-5');
  });

  it('lets a caller override the list start padding', () => {
    render(
      <MarkdownRenderer content={LIST_MARKDOWN} classNames={{ ul: 'ps-10' }} />,
    );

    const list = screen.getByRole('list');
    expect(list.className).toContain('ps-10');
    expect(list.className).not.toContain('ps-[2em]');
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

  it('renders double-dollar LaTeX as a KaTeX math element once the engine loads', async () => {
    render(<MarkdownRenderer content="Equation: $$x^2 + y^2 = z^2$$" />);

    /*
     * KaTeX loads on demand (see the "math path" describe block below), so
     * the <math> element only appears after that async load resolves.
     * MathML's `<math>` element also crashes `getByRole` under jsdom (jsdom
     * cannot compute styles for MathML elements), so a plain selector is
     * the only reliable way to assert its presence here.
     */
    await waitFor(() => {
      // eslint-disable-next-line testing-library/no-node-access
      expect(document.querySelector('math')).toBeTruthy();
    });
  });

  it('wraps block LaTeX in a horizontally scrollable container so a wide formula stays reachable', async () => {
    render(<MarkdownRenderer content={DISPLAY_MATH_MARKDOWN} />);

    /*
     * MathML elements have no accessible role under jsdom, so the scroll
     * container is reached by walking up from the <math> element itself —
     * which only exists once the on-demand KaTeX load has resolved.
     */
    await waitFor(() => {
      // eslint-disable-next-line testing-library/no-node-access
      expect(document.querySelector('math[display="block"]')).toBeTruthy();
    });

    // eslint-disable-next-line testing-library/no-node-access
    const math = document.querySelector('math[display="block"]');
    // eslint-disable-next-line testing-library/no-node-access
    const katexSpan = math?.parentElement;
    // eslint-disable-next-line testing-library/no-node-access
    const scrollContainer = katexSpan?.parentElement;

    expect(katexSpan?.className).toContain('katex');
    expect(scrollContainer?.className).toContain('overflow-x-auto');
    expect(scrollContainer?.className).toContain('max-w-full');
    expect(scrollContainer?.className).toContain('min-w-0');
  });

  it('keeps KaTeX wrapper classes through sanitization but drops classes from raw HTML', async () => {
    render(
      <MarkdownRenderer
        content={`${DISPLAY_MATH_MARKDOWN}\n\n<span class="injected">text</span><script>alert(1)</script>`}
      />,
    );

    await waitFor(() => {
      // eslint-disable-next-line testing-library/no-node-access -- class-level assertions have no semantic query
      expect(document.querySelector('span.katex')).toBeTruthy();
    });

    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector('span.injected')).toBeNull();
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector('script')).toBeNull();
  });

  it('leaves inline LaTeX inside its paragraph rather than in a scroll container', async () => {
    render(<MarkdownRenderer content="Cost: $x + y$ per unit" />);

    await waitFor(() => {
      // eslint-disable-next-line testing-library/no-node-access -- see note above: MathML has no role under jsdom
      expect(document.querySelector('math')).toBeTruthy();
    });

    // eslint-disable-next-line testing-library/no-node-access
    const math = document.querySelector('math');
    // eslint-disable-next-line testing-library/no-node-access
    const katexSpan = math?.parentElement;

    expect(math?.getAttribute('display')).toBeNull();
    expect(katexSpan?.parentElement?.tagName).toBe('P');
  });

  it('renders single-dollar inline LaTeX as a KaTeX math element once the engine loads', async () => {
    render(<MarkdownRenderer content="Cost: $x + y$" />);

    await waitFor(() => {
      // eslint-disable-next-line testing-library/no-node-access -- see note above: getByRole('math') crashes under jsdom
      expect(document.querySelector('math')).toBeTruthy();
    });
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

  describe('deferred heavy dependencies', () => {
    it('renders plain text immediately with no math element and no highlighted-code marker (fast path)', () => {
      render(
        <MarkdownRenderer content="Just a plain sentence, nothing fancy." />,
      );

      expect(
        screen.getByText('Just a plain sentence, nothing fancy.'),
      ).toBeTruthy();
      // eslint-disable-next-line testing-library/no-node-access -- no accessible role for either check; see the math-test notes above
      expect(document.querySelector('math')).toBeNull();
      // eslint-disable-next-line testing-library/no-node-access -- the mocked Prism output carries this attribute; its absence confirms the highlighter never loaded
      expect(document.querySelector('[data-language]')).toBeNull();
    });

    it('highlights a fenced code block once the syntax-highlighting engine loads (code-block path)', async () => {
      render(<MarkdownRenderer content={FENCED_TS_MARKDOWN} />);

      await waitFor(() => {
        // eslint-disable-next-line testing-library/no-node-access -- the mocked Prism output has no accessible role
        const highlighted = document.querySelector(
          '[data-language="typescript"]',
        );
        expect(highlighted).toBeTruthy();
      });
    });

    it('renders a plain-text message, then gains a code fence mid-stream and highlights it once loaded', async () => {
      const { rerender } = render(
        <MarkdownRenderer content="Let me think about that..." />,
      );

      expect(screen.getByText('Let me think about that...')).toBeTruthy();
      // eslint-disable-next-line testing-library/no-node-access
      expect(document.querySelector('[data-language]')).toBeNull();

      rerender(
        <MarkdownRenderer
          content={`Let me think about that...\n\n${FENCED_TS_MARKDOWN}`}
        />,
      );

      await waitFor(() => {
        // eslint-disable-next-line testing-library/no-node-access
        const highlighted = document.querySelector(
          '[data-language="typescript"]',
        );
        expect(highlighted).toBeTruthy();
      });
    });

    it('renders a plain-text message, then gains a math block mid-stream and renders it once loaded', async () => {
      const { rerender } = render(
        <MarkdownRenderer content="Let me think about that..." />,
      );

      // eslint-disable-next-line testing-library/no-node-access -- see math-test notes above
      expect(document.querySelector('math')).toBeNull();

      rerender(
        <MarkdownRenderer content="Let me think about that... $$x^2 = 4$$" />,
      );

      await waitFor(() => {
        // eslint-disable-next-line testing-library/no-node-access
        expect(document.querySelector('math')).toBeTruthy();
      });
    });
  });
});
