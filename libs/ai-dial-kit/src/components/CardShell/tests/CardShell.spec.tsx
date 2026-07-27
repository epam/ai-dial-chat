import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CardShell } from '../CardShell';

describe('CardShell', () => {
  it('renders its children', () => {
    render(
      <CardShell>
        <span>Card content</span>
      </CardShell>,
    );

    expect(screen.getByText('Card content')).toBeTruthy();
  });

  it('forwards role, aria-label, and click/keydown handlers', async () => {
    const onClick = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <CardShell
        role="button"
        aria-label="Competitor Updates"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        content
      </CardShell>,
    );

    const card = screen.getByRole('button', { name: 'Competitor Updates' });
    await userEvent.click(card);
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(onClick).toHaveBeenCalledOnce();
    expect(onKeyDown).toHaveBeenCalledOnce();
  });

  it('merges a caller className with the shell defaults', () => {
    render(<CardShell className="h-[232px]">content</CardShell>);

    expect(screen.getByText('content').className).toContain('h-[232px]');
    expect(screen.getByText('content').className).toContain('rounded-[20px]');
  });

  it('forwards style for dynamic per-item overrides', () => {
    render(
      <CardShell style={{ borderColor: 'rgb(1, 2, 3)' }}>content</CardShell>,
    );

    expect(screen.getByText('content').style.borderColor).toBe('rgb(1, 2, 3)');
  });
});
