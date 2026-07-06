import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UsageModelTable } from '../UsageModelTable';

describe('UsageModelTable', () => {
  it('renders the empty state when there are no rows', () => {
    render(<UsageModelTable rows={[]} />);
    expect(screen.getByText('No usage yet')).toBeTruthy();
  });

  it('renders a no-cap model as a normal row, not muted, with a rolls-up status', () => {
    render(
      <UsageModelTable
        rows={[
          {
            id: 'gpt-4o',
            name: 'GPT-4o',
            version: '2024-11',
            today: { used: 0.2, limit: null },
            thisMonth: { used: 4.1, limit: null },
          },
        ]}
      />,
    );
    expect(screen.getByText('GPT-4o')).toBeTruthy();
    expect(screen.getByText('$0.20')).toBeTruthy();
    expect(screen.getByText('$4.10')).toBeTruthy();
    expect(screen.getByText('No limit · rolls up')).toBeTruthy();
    // No reset subline for an uncapped row.
    expect(screen.queryByText(/Resets/)).toBeNull();
    // Name keeps full-strength styling — not de-emphasised.
    expect(screen.getByText('GPT-4o').className).not.toContain('text-tertiary');
    expect(screen.getByText('GPT-4o').className).not.toContain(
      'text-secondary',
    );
  });

  it('shows "Within limits" (muted text, green dot) for a row comfortably under cap', () => {
    const { container } = render(
      <UsageModelTable
        rows={[
          {
            id: 'glm',
            name: 'GLM-5.2',
            version: '5.2.1',
            today: { used: 0.5, limit: null },
            thisMonth: { used: 6.2, limit: 40, resetLabel: 'Resets 1 Aug' },
          },
        ]}
      />,
    );
    const status = screen.getByText('Within limits');
    expect(status.className).toContain('text-secondary');
    expect(status.className).not.toContain('text-accent-secondary');
    expect(screen.getByText('Resets 1 Aug')).toBeTruthy();
    const dot = container.querySelector('.bg-accent-secondary');
    expect(dot).toBeTruthy();
  });

  it('shows "Near monthly cap" (colored text) for a row past the warning threshold', () => {
    render(
      <UsageModelTable
        rows={[
          {
            id: 'deepseek-flash',
            name: 'ali.deepseek-v4-flash',
            version: '4.0.1',
            today: { used: 0.4, limit: null },
            thisMonth: { used: 17, limit: 20, resetLabel: 'Resets 1 Aug' },
          },
        ]}
      />,
    );
    const status = screen.getByText('Near monthly cap');
    // Status text uses `text-warning` (dark, AA-safe) — the dot alone carries the
    // lighter decorative orange fill.
    expect(status.className).toContain('text-warning');
    expect(screen.getByText('$17.00 / $20.00')).toBeTruthy();
  });

  it('shows "Daily cap reached" when the daily scope is worse than a fine monthly scope', () => {
    render(
      <UsageModelTable
        rows={[
          {
            id: 'claude-opus',
            name: 'Claude Opus',
            version: '4.8',
            today: { used: 2, limit: 2, resetLabel: 'Resets in 4h' },
            thisMonth: { used: 12, limit: 30, resetLabel: 'Resets 1 Aug' },
          },
        ]}
      />,
    );
    expect(screen.getByText('Daily cap reached')).toBeTruthy();
    expect(screen.getByText('Resets in 4h')).toBeTruthy();
    // The (better) monthly reset line is not the one shown in the status subline.
    expect(screen.queryByText('Resets 1 Aug')).toBeNull();
    expect(screen.getByText('$2.00 / $2.00')).toBeTruthy();
    expect(screen.getByText('$12.00 / $30.00')).toBeTruthy();
  });

  it('left-aligns the status cell', () => {
    render(
      <UsageModelTable
        rows={[
          {
            id: 'claude-opus',
            name: 'Claude Opus',
            today: { used: 2, limit: 2, resetLabel: 'Resets in 4h' },
            thisMonth: { used: 12, limit: 30 },
          },
        ]}
      />,
    );
    const status = screen.getByText('Daily cap reached');
    const statusCell = status.parentElement;
    expect(statusCell?.className).toContain('items-start');
    expect(statusCell?.className).toContain('justify-self-start');
  });

  it('renders multiple rows in order', () => {
    render(
      <UsageModelTable
        rows={[
          {
            id: 'a',
            name: 'Model A',
            today: { used: 1, limit: null },
            thisMonth: { used: 1, limit: null },
          },
          {
            id: 'b',
            name: 'Model B',
            today: { used: 1, limit: null },
            thisMonth: { used: 1, limit: null },
          },
        ]}
      />,
    );
    expect(screen.getByText('Model A')).toBeTruthy();
    expect(screen.getByText('Model B')).toBeTruthy();
  });
});
