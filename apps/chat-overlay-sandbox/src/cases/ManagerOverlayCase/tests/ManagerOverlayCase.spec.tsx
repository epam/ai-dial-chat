import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ManagerOverlayCase from '../ManagerOverlayCase';

const mocks = vi.hoisted(() => {
  const unsubscribe = vi.fn();
  const instanceMethods = {
    createOverlay: vi.fn(),
    ready: vi.fn().mockResolvedValue(true),
    getMessages: vi.fn().mockResolvedValue({ messages: [] }),
    sendMessage: vi.fn().mockResolvedValue({ messages: [] }),
    setOverlayOptions: vi.fn().mockResolvedValue({ applied: true }),
    setInputContent: vi.fn().mockResolvedValue(undefined),
    setSystemPrompt: vi.fn().mockResolvedValue({ systemPrompt: '' }),
    setTemperature: vi.fn().mockResolvedValue({ temperature: 0.2 }),
    subscribe: vi.fn(() => unsubscribe),
    showOverlay: vi.fn(),
    hideOverlay: vi.fn(),
    removeOverlay: vi.fn(),
    openFullscreen: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  };
  return {
    instanceMethods,
    unsubscribe,
    ChatOverlayManager: vi
      .fn()
      .mockImplementation(function ChatOverlayManager() {
        return instanceMethods;
      }),
    getChatOverlayHost: vi.fn(() => 'https://chat.example.com'),
  };
});

vi.mock('@epam/ai-dial-chat-overlay', () => ({
  ChatOverlayManager: mocks.ChatOverlayManager,
  OverlayEventType: {
    InitReady: '@DIAL_OVERLAY/INIT_READY',
    Ready: '@DIAL_OVERLAY/READY',
    ReadyToInteract: '@DIAL_OVERLAY/READY_TO_INTERACT',
    GptStartGenerating: '@DIAL_OVERLAY/GPT_START_GENERATING',
    GptEndGenerating: '@DIAL_OVERLAY/GPT_END_GENERATING',
    StopGenerating: '@DIAL_OVERLAY/STOP_GENERATING',
    SelectedConversationLoaded: '@DIAL_OVERLAY/SELECTED_CONVERSATION_LOADED',
    ConversationsUpdated: '@DIAL_OVERLAY/CONVERSATIONS_UPDATED',
  },
  OverlayPosition: { RightBottom: 'right-bottom' },
}));

vi.mock('../../../env', () => ({
  getChatOverlayHost: mocks.getChatOverlayHost,
}));

describe('ManagerOverlayCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ChatOverlayManager.mockImplementation(function ChatOverlayManager() {
      return mocks.instanceMethods;
    });
    mocks.getChatOverlayHost.mockReturnValue('https://chat.example.com');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an overlay with position and allowFullscreen set', () => {
    render(<ManagerOverlayCase />);

    expect(mocks.instanceMethods.createOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'https://chat.example.com',
        position: 'right-bottom',
        allowFullscreen: true,
        loaderHideEvent: '@DIAL_OVERLAY/READY',
      }),
    );
    expect(mocks.instanceMethods.ready).toHaveBeenCalledWith(
      'sandbox-manager-overlay',
    );
    expect(mocks.instanceMethods.subscribe).toHaveBeenCalledTimes(8);
  });

  it('calls showOverlay, hideOverlay, and removeOverlay for the created overlayId', async () => {
    const user = userEvent.setup();
    render(<ManagerOverlayCase />);
    const overlayId = mocks.instanceMethods.createOverlay.mock.calls[0][0]
      .overlayId as string;

    await user.click(screen.getByRole('button', { name: 'Show overlay' }));
    expect(mocks.instanceMethods.showOverlay).toHaveBeenCalledWith(overlayId);

    await user.click(screen.getByRole('button', { name: 'Hide overlay' }));
    expect(mocks.instanceMethods.hideOverlay).toHaveBeenCalledWith(overlayId);

    await user.click(screen.getByRole('button', { name: 'Remove overlay' }));
    expect(mocks.instanceMethods.removeOverlay).toHaveBeenCalledWith(overlayId);
  });

  it('calls openFullscreen for the created overlayId', async () => {
    const user = userEvent.setup();
    render(<ManagerOverlayCase />);
    const overlayId = mocks.instanceMethods.createOverlay.mock.calls[0][0]
      .overlayId as string;

    await user.click(screen.getByRole('button', { name: 'Open full screen' }));

    expect(mocks.instanceMethods.openFullscreen).toHaveBeenCalledWith(
      overlayId,
    );
  });

  it('calls v1 overlay methods through the manager controls', async () => {
    const user = userEvent.setup();
    render(<ManagerOverlayCase />);
    const overlayId = mocks.instanceMethods.createOverlay.mock.calls[0][0]
      .overlayId as string;

    await waitFor(() => {
      expect(screen.getByText('Ready: yes')).toBeTruthy();
    });

    await user.click(screen.getByRole('button', { name: 'Get messages' }));
    expect(mocks.instanceMethods.getMessages).toHaveBeenCalledWith(overlayId);

    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(mocks.instanceMethods.sendMessage).toHaveBeenCalledWith(
      overlayId,
      'Hello from the manager sandbox',
    );

    await user.click(
      screen.getByRole('button', { name: 'Update theme + model' }),
    );
    expect(mocks.instanceMethods.setOverlayOptions).toHaveBeenCalledWith(
      overlayId,
      { theme: 'dark', modelId: 'gpt-4o' },
    );

    await user.click(
      screen.getByRole('button', { name: 'Update theme to light' }),
    );
    expect(mocks.instanceMethods.setOverlayOptions).toHaveBeenCalledWith(
      overlayId,
      { theme: 'light' },
    );

    await user.click(screen.getByRole('button', { name: 'Set input content' }));
    expect(mocks.instanceMethods.setInputContent).toHaveBeenCalledWith(
      overlayId,
      'Drafted from the manager sandbox',
    );

    await user.click(
      screen.getByRole('button', { name: 'Clear input content' }),
    );
    expect(mocks.instanceMethods.setInputContent).toHaveBeenCalledWith(
      overlayId,
      '',
    );

    await user.click(screen.getByRole('button', { name: 'Set system prompt' }));
    expect(mocks.instanceMethods.setSystemPrompt).toHaveBeenCalledWith(
      overlayId,
      'Answer concisely.',
    );

    await user.click(screen.getByRole('button', { name: 'Set temperature' }));
    expect(mocks.instanceMethods.setTemperature).toHaveBeenCalledWith(
      overlayId,
      0.2,
    );
  });

  it('ignores ready() rejection from a cleaned-up manager instance', async () => {
    let rejectFirstReady: (reason?: unknown) => void = () => undefined;
    mocks.instanceMethods.ready
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectFirstReady = reject;
          }),
      )
      .mockImplementationOnce(() => new Promise(() => undefined));

    render(
      <StrictMode>
        <ManagerOverlayCase />
      </StrictMode>,
    );
    await waitFor(() =>
      expect(mocks.instanceMethods.ready).toHaveBeenCalledTimes(2),
    );

    await act(async () => {
      rejectFirstReady(new Error('destroyed'));
      await Promise.resolve();
    });

    expect(screen.queryByText(/ready\(\) rejected/)).toBeNull();
  });

  it('destroys the manager on unmount', () => {
    const { unmount } = render(<ManagerOverlayCase />);
    unmount();

    expect(mocks.unsubscribe).toHaveBeenCalledTimes(8);
    expect(mocks.instanceMethods.destroy).toHaveBeenCalledOnce();
  });
});
