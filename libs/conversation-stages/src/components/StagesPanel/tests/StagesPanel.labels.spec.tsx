import { StageStatus } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StagesPanel } from '../StagesPanel';

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

/* Uses the real kit and shared `MarkdownCodeBlock` (the main spec stubs the
 * kit) so the copied status is the one a screen reader actually hears. */
describe('StagesPanel — stage content labels', () => {
  it('announces the host copied label after a stage code block is copied', async () => {
    const user = userEvent.setup();
    render(
      <StagesPanel
        stages={[
          {
            index: 0,
            name: 'Completed step',
            status: StageStatus.Completed,
            content: '```json\n{"ok":true}\n```',
          },
        ]}
        isStreaming={false}
        labels={{
          copyAriaLabel: 'Kopieren',
          codeBlockCopiedLabel: 'Kopiert!',
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Completed step' }));
    await user.click(screen.getByRole('button', { name: 'Kopieren' }));

    expect(await screen.findByText('Kopiert!')).toBeTruthy();
  });
});

describe('StagesPanel — stage content table label', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('names an overflowing stage table scroll region with the host label', async () => {
    const user = userEvent.setup();
    mockOverflowingTables();
    render(
      <StagesPanel
        stages={[
          {
            index: 0,
            name: 'Completed step',
            status: StageStatus.Completed,
            content: '| a | b |\n| - | - |\n| 1 | 2 |',
          },
        ]}
        isStreaming={false}
        labels={{ tableScrollRegionAriaLabel: 'Scrollbare Tabelle' }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Completed step' }));

    expect(
      screen.getByRole('region', { name: 'Scrollbare Tabelle' }),
    ).toBeTruthy();
  });
});
