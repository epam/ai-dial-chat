import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScheduledTaskDetailsSummary } from '../ScheduledTaskDetailsSummary';

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

/* Uses the real `MDMessageViewer` (the main spec mocks it) so the assertions
 * cover the built-in fallback viewer down to the rendered elements. */
describe('ScheduledTaskDetailsSummary — built-in markdown viewer labels', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('names the instructions code-block buttons with the host labels', () => {
    render(
      <ScheduledTaskDetailsSummary
        modelLabel="Model"
        instructionsLabel="Instructions"
        instructionsMarkdown={'```ts\nconst a = 1;\n```'}
        markdownLabels={{
          codeBlockCopyLabel: 'Kopieren',
          codeBlockDownloadLabel: 'Herunterladen',
        }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Kopieren' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Herunterladen' })).toBeTruthy();
  });

  it('names an overflowing instructions table scroll region with the host label', () => {
    mockOverflowingTables();
    render(
      <ScheduledTaskDetailsSummary
        modelLabel="Model"
        instructionsLabel="Instructions"
        instructionsMarkdown={'| a | b |\n| - | - |\n| 1 | 2 |'}
        markdownLabels={{ tableScrollRegionAriaLabel: 'Scrollbare Tabelle' }}
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Scrollbare Tabelle' }),
    ).toBeTruthy();
  });
});
