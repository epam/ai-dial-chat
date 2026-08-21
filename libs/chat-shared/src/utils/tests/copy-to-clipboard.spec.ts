import { describe, expect, it } from 'vitest';
import { markdownToRichTextHtml } from '../copy-to-clipboard';

const TABLE_MARKDOWN = [
  '| Year | Song |',
  '| --- | --- |',
  '| **2026** | *"Bangaranga"* |',
  '| **2025** | *"Wasted Love"* |',
  '| **2024** | *"The Code"* |',
].join('\n');

describe('markdownToRichTextHtml', () => {
  it('gives the table its border so a paste target draws the grid', () => {
    const html = markdownToRichTextHtml(TABLE_MARKDOWN);

    expect(html).toContain('<table style="');
    expect(html).toContain('border-collapse:collapse');
    expect(html).toContain('border:1px solid #d1dbea');
  });

  it('styles the header band apart from the body cells', () => {
    const html = markdownToRichTextHtml(TABLE_MARKDOWN);

    expect(html).toContain('<th style="background:#fcfcfc');
    expect(html).toContain('<td style="border-top:1px solid #e0e6f0');
  });

  it('stripes every second body row, which no inline style could express', () => {
    const html = markdownToRichTextHtml(TABLE_MARKDOWN);
    const stripedRows = html.match(/<tr style="background:#f5f7fa"/g) ?? [];

    /* Three body rows — only the second one is striped. */
    expect(stripedRows).toHaveLength(1);
  });

  it('keeps the emphasis markdown carries on its own', () => {
    const html = markdownToRichTextHtml(TABLE_MARKDOWN);

    expect(html).toContain('<strong>2026</strong>');
    expect(html).toContain('<em>"Bangaranga"</em>');
  });

  it('styles headings, paragraphs, lists, quotes, links and rules', () => {
    const html = markdownToRichTextHtml(
      [
        '# Title',
        '',
        'Text with a [link](https://dialx.ai).',
        '',
        '- item',
        '',
        '> quote',
        '',
        '---',
      ].join('\n'),
    );

    expect(html).toContain('<h1 style="font-size:20px');
    expect(html).toContain('<p style="font-size:14px');
    expect(html).toContain('<ul style="font-size:14px');
    expect(html).toContain('<blockquote style="border-inline-start:3px solid');
    expect(html).toContain('<hr style="border:0');
    /* Attribute order is the serializer's business — `href` lands first here. */
    expect(html).toMatch(/<a [^>]*style="color:#2764d9/);
  });

  it('leaves code inside a fence without the inline-code chip', () => {
    const html = markdownToRichTextHtml('```ts\nconst a = 1;\n```');

    expect(html).toContain('<pre style="background:#f8fafc');
    /* The <pre> already draws the box; a second background inside it reads as
       a nested chip, so the fenced <code> carries the face and nothing else. */
    expect(html).toMatch(
      /<code [^>]*style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;color:#161b2d"/,
    );
  });

  it('drops markup that does not belong in a pasted document', () => {
    const html = markdownToRichTextHtml(
      'Before\n\n<script>alert(1)</script>\n\nAfter',
    );

    expect(html).not.toContain('<script');
    expect(html).toContain('Before');
    expect(html).toContain('After');
  });
});
