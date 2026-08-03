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
vi.mock('../../cases/ConversationListCase/ConversationListCase', () => ({
  default: () => <div>Conversation-list case content</div>,
}));
vi.mock('../../cases/EnabledFeaturesCase/EnabledFeaturesCase', () => ({
  default: () => <div>Enabled-features case content</div>,
}));
vi.mock('../../cases/AuthUiModeCase/AuthUiModeCase', () => ({
  default: () => <div>Auth UI mode case content</div>,
}));

describe('App', () => {
  it('lists the v1-scoped cases and the conversation-list case', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Chat Overlay Sandbox', level: 1 }),
    ).toBeTruthy();
    expect(screen.getByText('5 scenarios')).toBeTruthy();

    expect(
      screen.getByRole('button', { name: 'Direct ChatOverlay case' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'ChatOverlayManager case' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Conversation-list methods case',
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'enabledFeatures case' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Provider auth UI mode case' }),
    ).toBeTruthy();
  });

  it('does not present still-deferred playback/import-export cases', () => {
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

    await user.click(screen.getByRole('button', { name: 'Back to case list' }));
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

  it('navigates to the conversation-list case', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Conversation-list methods case',
      }),
    );
    expect(screen.getByText('Conversation-list case content')).toBeTruthy();
  });

  it('navigates to the enabledFeatures case', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', { name: 'enabledFeatures case' }),
    );
    expect(screen.getByText('Enabled-features case content')).toBeTruthy();
  });

  it('navigates to the provider auth UI mode case', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', { name: 'Provider auth UI mode case' }),
    );

    expect(screen.getByText('Auth UI mode case content')).toBeTruthy();
  });
});
