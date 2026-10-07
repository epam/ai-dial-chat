import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownWithPlaceholders } from '../MarkdownWithPlaceholders';

/* jsdom has no layout; report every table as wider than its scroll container
 * so `MarkdownTable` exposes its labelled scroll region. */
const mockOverflowingTables = () => {
  vi.spyOn(HTMLDivElement.prototype, 'scrollWidth', 'get').mockReturnValue(400);
  vi.spyOn(HTMLDivElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
  vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: 200,
  } as DOMRect);
  vi.spyOn(HTMLTableElement.prototype, 'getBoundingClientRect').mockReturnValue(
    { left: 0, right: 400 } as DOMRect,
  );
};

describe('MarkdownWithPlaceholders', () => {
  it('names the code-block buttons with the supplied labels', () => {
    render(
      <MarkdownWithPlaceholders
        content={'```ts\nconst a = 1;\n```'}
        codeBlockCopyLabel="Kopieren"
        codeBlockDownloadLabel="Herunterladen"
      />,
    );

    expect(screen.getByRole('button', { name: 'Kopieren' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Herunterladen' })).toBeTruthy();
  });
});

describe('MarkdownWithPlaceholders — table label', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('names an overflowing table scroll region with the supplied label', () => {
    mockOverflowingTables();
    render(
      <MarkdownWithPlaceholders
        content={'| a | b |\n| - | - |\n| 1 | 2 |'}
        tableScrollRegionAriaLabel="Scrollbare Tabelle"
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Scrollbare Tabelle' }),
    ).toBeTruthy();
  });
});
