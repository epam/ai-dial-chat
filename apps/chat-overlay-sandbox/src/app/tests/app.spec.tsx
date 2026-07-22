import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../app';

vi.mock('../../cases/DirectOverlayCase/DirectOverlayCase', () => ({
  default: () => <div>Direct case content</div>,
}));
vi.mock('../../cases/ManagerOverlayCase/ManagerOverlayCase', () => ({
  default: () => <div>Manager case content</div>,
}));

describe('App', () => {
  it('lists only the v1-scoped cases', () => {
    render(<App />);

    expect(
      screen.getByRole('button', { name: 'Direct ChatOverlay case' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'ChatOverlayManager case' }),
    ).toBeTruthy();
  });

  it('does not present conversation create/rename/delete/select/playback/import-export cases', () => {
    render(<App />);

    const forbiddenPatterns = [
      /create conversation/i,
      /rename conversation/i,
      /delete conversation/i,
      /select conversation/i,
      /playback/i,
      /import/i,
      /export/i,
      /custom message button/i,
    ];
    for (const pattern of forbiddenPatterns) {
      expect(screen.queryByText(pattern)).toBeNull();
    }
  });

  it('navigates to the direct case and back', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', { name: 'Direct ChatOverlay case' }),
    );
    expect(screen.getByText('Direct case content')).toBeTruthy();

    await user.click(
      screen.getByRole('button', { name: '← Back to case list' }),
    );
    expect(
      screen.getByRole('button', { name: 'Direct ChatOverlay case' }),
    ).toBeTruthy();
  });

  it('navigates to the manager case', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', { name: 'ChatOverlayManager case' }),
    );
    expect(screen.getByText('Manager case content')).toBeTruthy();
  });
});
