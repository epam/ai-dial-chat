import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  copyMarkdownAsRichText,
  markdownToRichTextHtml,
} from '../copy-to-clipboard';

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

  it('paints the table surface, so its dark text survives a dark-themed target', () => {
    const html = markdownToRichTextHtml(TABLE_MARKDOWN);

    expect(html).toMatch(
      /<table style="[^"]*background:#ffffff[^"]*color:#161b2d/,
    );
  });

  it('leaves flowing text its color, which the host document owns', () => {
    const html = markdownToRichTextHtml(
      '# Title\n\nParagraph.\n\n- item\n\n> quote\n\n[link](https://dialx.ai)',
    );

    /* A `color` with no background under it is the dark-theme bug: the host
       paints the surface, so only structure travels for flowing text. */
    const styledFlowingText =
      html.match(/<(?:h1|p|ul|li|blockquote|a) [^>]*style="[^"]*"/g) ?? [];

    expect(styledFlowingText.length).toBeGreaterThan(0);
    styledFlowingText.forEach((tag) => expect(tag).not.toContain('color:'));
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
    /* Attribute order is the serializer's business — `href` lands first here.
       The link keeps its underline; the color belongs to the host document,
       which styles hyperlinks itself. */
    expect(html).toMatch(/<a [^>]*style="text-decoration:underline/);
  });

  it('leaves code inside a fence without the inline-code chip', () => {
    const html = markdownToRichTextHtml('```ts\nconst a = 1;\n```');

    expect(html).toContain('<pre style="background:#f8fafc');
    /* The <pre> already draws the box and the surface behind it; repeating
       either inside reads as a nested chip, so the fenced <code> carries the
       monospace face and nothing else. */
    expect(html).toMatch(
      /<code [^>]*style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px"/,
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

const originalClipboard = navigator.clipboard;
const originalClipboardItem = globalThis.ClipboardItem;

const setClipboard = (clipboard: unknown): void => {
  Object.defineProperty(navigator, 'clipboard', {
    value: clipboard,
    configurable: true,
  });
};

/** jsdom's `Blob` has no `text()`, so the bytes come back through `FileReader`. */
const readBlob = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

/** Reads back the flavours of the single `ClipboardItem` handed to `write`. */
const writtenFlavours = async (
  write: ReturnType<typeof vi.fn>,
): Promise<Record<string, string>> => {
  const [items] = write.mock.calls[0] as [ClipboardItem[]];
  const item = items[0];
  const entries = await Promise.all(
    item.types.map(
      async (type) => [type, await readBlob(await item.getType(type))] as const,
    ),
  );
  return Object.fromEntries(entries);
};

describe('copyMarkdownAsRichText', () => {
  beforeEach(() => {
    /* jsdom ships no ClipboardItem, so the multi-format path needs a stand-in
       that keeps its blobs readable. */
    globalThis.ClipboardItem = class {
      constructor(private readonly data: Record<string, Blob>) {}
      get types(): string[] {
        return Object.keys(this.data);
      }
      getType(type: string): Promise<Blob> {
        return Promise.resolve(this.data[type]);
      }
    } as unknown as typeof ClipboardItem;
  });

  afterEach(() => {
    setClipboard(originalClipboard);
    globalThis.ClipboardItem = originalClipboardItem;
  });

  it('offers the rich flavour alongside the plain one a text editor reads', async () => {
    const write = vi.fn(async () => undefined);
    setClipboard({ write, writeText: vi.fn(async () => undefined) });

    await expect(copyMarkdownAsRichText('# hi')).resolves.toBe(true);

    const flavours = await writtenFlavours(write);
    expect(Object.keys(flavours).sort()).toEqual(['text/html', 'text/plain']);
    expect(flavours['text/html']).toContain('<h1 style="font-size:20px');
    /* Plain-text targets get the markdown source — the alternative today is an
       empty paste. */
    expect(flavours['text/plain']).toBe('# hi');
  });

  it('falls back to the plain-text copy when the clipboard write is refused', async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard({
      write: vi.fn(async () => {
        throw new Error('denied');
      }),
      writeText,
    });

    await expect(copyMarkdownAsRichText('# hi')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('# hi');
  });

  it('falls back to the plain-text copy when the multi-format API is absent', async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard({ writeText });

    await expect(copyMarkdownAsRichText('# hi')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('# hi');
  });
});
