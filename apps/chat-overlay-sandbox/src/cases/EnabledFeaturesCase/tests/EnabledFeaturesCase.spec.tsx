import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EnabledFeaturesCase from '../EnabledFeaturesCase';

const mocks = vi.hoisted(() => {
  const instanceMethods = {
    ready: vi.fn().mockResolvedValue(true),
    destroy: vi.fn(),
    setOverlayOptions: vi.fn().mockResolvedValue({ applied: true }),
  };
  return {
    instanceMethods,
    ChatOverlay: vi.fn().mockImplementation(function ChatOverlay() {
      return instanceMethods;
    }),
    getChatOverlayHost: vi.fn(() => 'https://chat.example.com'),
  };
});

vi.mock('@epam/ai-dial-chat-overlay', () => ({
  ChatOverlay: mocks.ChatOverlay,
  OverlayEventType: { Ready: '@DIAL_OVERLAY/READY' },
  OverlayFeature: {
    Header: 'header',
    ConversationsSection: 'conversations-section',
    ConversationsPanelToggle: 'conversations-panel-toggle',
    Likes: 'likes',
    ConversationsSharing: 'conversations-sharing',
    VoiceInput: 'voice-input',
  },
}));

vi.mock('../../../env', () => ({
  getChatOverlayHost: mocks.getChatOverlayHost,
}));

describe('EnabledFeaturesCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ChatOverlay.mockImplementation(function ChatOverlay() {
      return mocks.instanceMethods;
    });
    mocks.getChatOverlayHost.mockReturnValue('https://chat.example.com');
  });

  it('calls setOverlayOptions with the "Header + sharing only" preset', async () => {
    const user = userEvent.setup();
    render(<EnabledFeaturesCase />);

    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Header + sharing only',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );

    await user.click(
      screen.getByRole('button', { name: 'Header + sharing only' }),
    );

    expect(mocks.instanceMethods.setOverlayOptions).toHaveBeenCalledWith({
      enabledFeatures: ['header', 'conversations-sharing'],
    });
  });

  it('calls setOverlayOptions with an empty array for the "Empty set" preset', async () => {
    const user = userEvent.setup();
    render(<EnabledFeaturesCase />);

    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Empty set',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );

    await user.click(screen.getByRole('button', { name: 'Empty set' }));

    expect(mocks.instanceMethods.setOverlayOptions).toHaveBeenCalledWith({
      enabledFeatures: [],
    });
  });

  it('calls setOverlayOptions with an unrecognized value for the intentionally-invalid preset', async () => {
    const user = userEvent.setup();
    render(<EnabledFeaturesCase />);

    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Header + invalid value (demo)',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Header + invalid value (demo)',
      }),
    );

    expect(mocks.instanceMethods.setOverlayOptions).toHaveBeenCalledWith({
      enabledFeatures: ['header', 'not-a-real-feature'],
    });
  });

  it('normalizes and applies a custom comma-separated list', async () => {
    const user = userEvent.setup();
    render(<EnabledFeaturesCase />);

    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Apply custom list',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );

    await user.type(
      screen.getByLabelText('Custom comma-separated list'),
      'header, likes ,  ',
    );
    await user.click(screen.getByRole('button', { name: 'Apply custom list' }));

    expect(mocks.instanceMethods.setOverlayOptions).toHaveBeenCalledWith({
      enabledFeatures: ['header', 'likes'],
    });
  });
});
