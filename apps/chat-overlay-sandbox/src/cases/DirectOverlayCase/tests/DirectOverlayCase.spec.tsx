import { OverlayEventType } from '@epam/ai-dial-chat-overlay';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DirectOverlayCase from '../DirectOverlayCase';

const mocks = vi.hoisted(() => {
  const instanceMethods = {
    ready: vi.fn(() => new Promise(() => undefined)),
    subscribe: vi.fn().mockReturnValue(vi.fn()),
    destroy: vi.fn(),
    getMessages: vi.fn().mockResolvedValue({ messages: [] }),
    sendMessage: vi.fn().mockResolvedValue({ messages: [] }),
    setOverlayOptions: vi.fn().mockResolvedValue({ applied: true }),
    setInputContent: vi.fn().mockResolvedValue(undefined),
    setSystemPrompt: vi.fn().mockResolvedValue({ systemPrompt: '' }),
    setTemperature: vi.fn().mockResolvedValue({ temperature: 0 }),
  };
  return {
    instanceMethods,
    ChatOverlay: vi.fn().mockImplementation(function ChatOverlay() {
      return instanceMethods;
    }),
    getChatOverlayHost: vi.fn(() => 'https://chat.example.com'),
  };
});

vi.mock('@epam/ai-dial-chat-overlay', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-overlay')>()),
  ChatOverlay: mocks.ChatOverlay,
}));

vi.mock('../../../env', () => ({
  getChatOverlayHost: mocks.getChatOverlayHost,
}));

describe('DirectOverlayCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.instanceMethods.ready.mockImplementation(
      () => new Promise(() => undefined),
    );
    mocks.ChatOverlay.mockImplementation(function ChatOverlay() {
      return mocks.instanceMethods;
    });
    mocks.getChatOverlayHost.mockReturnValue('https://chat.example.com');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('constructs ChatOverlay with the configured domain and loaderHideEvent', () => {
    render(<DirectOverlayCase />);

    expect(mocks.ChatOverlay).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        domain: 'https://chat.example.com',
        loaderHideEvent: OverlayEventType.Ready,
      }),
    );
  });

  it('subscribes to bootstrap and v1 events', () => {
    render(<DirectOverlayCase />);

    const subscribedTypes = mocks.instanceMethods.subscribe.mock.calls.map(
      ([type]) => type,
    );
    expect(subscribedTypes).toEqual(
      expect.arrayContaining([
        OverlayEventType.InitReady,
        OverlayEventType.Ready,
        OverlayEventType.ReadyToInteract,
        OverlayEventType.GptStartGenerating,
        OverlayEventType.GptEndGenerating,
        OverlayEventType.StopGenerating,
        OverlayEventType.SelectedConversationLoaded,
        OverlayEventType.ConversationsUpdated,
      ]),
    );
  });

  it('calls setOverlayOptions with theme and modelId when "Update theme + model" is clicked', async () => {
    const user = userEvent.setup();
    mocks.instanceMethods.ready.mockResolvedValueOnce(true);
    render(<DirectOverlayCase />);

    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Update theme + model',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );

    await user.click(
      screen.getByRole('button', { name: 'Update theme + model' }),
    );

    expect(mocks.instanceMethods.setOverlayOptions).toHaveBeenCalledWith({
      theme: 'dark',
      modelId: 'gpt-4o',
    });
  });

  it('calls setOverlayOptions with light theme when "Update theme to light" is clicked', async () => {
    const user = userEvent.setup();
    mocks.instanceMethods.ready.mockResolvedValueOnce(true);
    render(<DirectOverlayCase />);

    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Update theme to light',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );

    await user.click(
      screen.getByRole('button', { name: 'Update theme to light' }),
    );

    expect(mocks.instanceMethods.setOverlayOptions).toHaveBeenCalledWith({
      theme: 'light',
    });
  });

  it('calls sendMessage when "Send message" is clicked', async () => {
    const user = userEvent.setup();
    mocks.instanceMethods.ready.mockResolvedValueOnce(true);
    render(<DirectOverlayCase />);

    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Send message',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );

    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(mocks.instanceMethods.sendMessage).toHaveBeenCalledWith(
      'Hello from the sandbox',
    );
  });

  it('reports rejected actions in the console and Event log', async () => {
    const user = userEvent.setup();
    const error = new Error(
      'ChatOverlay: request "@DIAL_OVERLAY/GET_MESSAGES" failed [ACTIVE_CONVERSATION_UNAVAILABLE]: No active conversation is open.',
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mocks.instanceMethods.ready.mockResolvedValueOnce(true);
    mocks.instanceMethods.getMessages.mockRejectedValueOnce(error);
    render(<DirectOverlayCase />);

    const getMessagesButton = await screen.findByRole('button', {
      name: 'Get messages',
    });
    await waitFor(() =>
      expect((getMessagesButton as HTMLButtonElement).disabled).toBe(false),
    );
    await user.click(getMessagesButton);

    const eventLogButton = await screen.findByRole('button', {
      name: /Event log 1 events/i,
    });
    await user.click(eventLogButton);
    expect(
      screen.getByText(/getMessages failed.*ACTIVE_CONVERSATION_UNAVAILABLE/),
    ).toBeTruthy();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('ACTIVE_CONVERSATION_UNAVAILABLE'),
      error,
    );
  });

  it('shows a configuration hint when the overlay handshake stays pending', () => {
    vi.useFakeTimers();

    render(<DirectOverlayCase />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByRole('alert').textContent).toContain(
      'OVERLAY_ENABLED=true',
    );
    expect(screen.getByRole('alert').textContent).toContain(
      'ALLOWED_IFRAME_ORIGINS',
    );
  });

  it('ignores ready() rejection from a cleaned-up overlay instance', async () => {
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
        <DirectOverlayCase />
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

  it('destroys the overlay and unsubscribes on unmount', () => {
    const { unmount } = render(<DirectOverlayCase />);
    unmount();

    expect(mocks.instanceMethods.destroy).toHaveBeenCalledOnce();
  });
});
