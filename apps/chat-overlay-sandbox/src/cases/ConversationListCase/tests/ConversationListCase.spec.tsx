import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConversationListCase from '../ConversationListCase';

const mocks = vi.hoisted(() => {
  const directInstanceMethods = {
    ready: vi.fn().mockResolvedValue(true),
    destroy: vi.fn(),
    getConversations: vi.fn().mockResolvedValue({ conversations: [] }),
    getSelectedConversations: vi.fn().mockResolvedValue({ conversations: [] }),
    createConversation: vi.fn().mockResolvedValue({ conversation: null }),
    createLocalConversation: vi.fn().mockResolvedValue({ conversation: null }),
    selectConversation: vi.fn().mockResolvedValue({}),
    renameConversation: vi.fn().mockResolvedValue({}),
    deleteConversation: vi.fn().mockResolvedValue({}),
  };
  return {
    directInstanceMethods,
    ChatOverlay: vi.fn().mockImplementation(function ChatOverlay() {
      return directInstanceMethods;
    }),
    getChatOverlayHost: vi.fn(() => 'https://chat.example.com'),
  };
});

vi.mock('@epam/ai-dial-chat-overlay', () => ({
  ChatOverlay: mocks.ChatOverlay,
}));

vi.mock('../../../env', () => ({
  getChatOverlayHost: mocks.getChatOverlayHost,
}));

describe('ConversationListCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ChatOverlay.mockImplementation(function ChatOverlay() {
      return mocks.directInstanceMethods;
    });
    mocks.directInstanceMethods.ready.mockResolvedValue(true);
    mocks.getChatOverlayHost.mockReturnValue('https://chat.example.com');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderReady = async () => {
    render(<ConversationListCase />);
    await waitFor(() => {
      const button = screen.getByRole('button', {
        name: 'Get conversations',
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });
  };

  it('calls getConversations on the overlay', async () => {
    const user = userEvent.setup();
    await renderReady();

    const button = screen.getByRole('button', {
      name: 'Get conversations',
    });

    await user.click(button);
    expect(mocks.directInstanceMethods.getConversations).toHaveBeenCalledOnce();
  });

  it('calls getSelectedConversations on the overlay', async () => {
    const user = userEvent.setup();
    await renderReady();

    const button = screen.getByRole('button', {
      name: 'Get selected conversations',
    });

    await user.click(button);
    expect(
      mocks.directInstanceMethods.getSelectedConversations,
    ).toHaveBeenCalledOnce();
  });

  it('calls createConversation with deploymentId and firstMessage from the direct section inputs', async () => {
    const user = userEvent.setup();
    await renderReady();

    const deploymentInput = screen.getByRole('textbox', {
      name: /Deployment id/,
    });
    const firstMessageInput = screen.getByRole('textbox', {
      name: /First message/,
    });
    const createButton = screen.getByRole('button', {
      name: 'Create conversation',
    });

    await user.type(deploymentInput, 'gpt-4o');
    await user.type(firstMessageInput, 'Hello!');
    await user.click(createButton);

    expect(mocks.directInstanceMethods.createConversation).toHaveBeenCalledWith(
      { deploymentId: 'gpt-4o', firstMessage: 'Hello!' },
    );
  });

  it('calls createConversation with undefined fields when the create inputs are left blank', async () => {
    const user = userEvent.setup();
    await renderReady();

    const createButton = screen.getByRole('button', {
      name: 'Create conversation',
    });

    await user.click(createButton);

    expect(mocks.directInstanceMethods.createConversation).toHaveBeenCalledWith(
      { deploymentId: undefined, firstMessage: undefined },
    );
  });

  it('calls createLocalConversation with no inputs', async () => {
    const user = userEvent.setup();
    await renderReady();

    const button = screen.getByRole('button', {
      name: 'Create local conversation',
    });
    await user.click(button);

    expect(
      mocks.directInstanceMethods.createLocalConversation,
    ).toHaveBeenCalledOnce();
  });

  it('calls selectConversation/renameConversation/deleteConversation with the typed id', async () => {
    const user = userEvent.setup();
    await renderReady();

    const conversationIdInput = screen.getByRole('textbox', {
      name: 'Conversation id override',
    });
    await user.type(conversationIdInput, 'conv-1');

    const selectButton = screen.getByRole('button', {
      name: 'Select conversation by id',
    });
    await user.click(selectButton);
    expect(mocks.directInstanceMethods.selectConversation).toHaveBeenCalledWith(
      'conv-1',
    );

    const newNameInput = screen.getByRole('textbox', {
      name: 'New conversation name',
    });
    await user.type(newNameInput, 'Renamed');
    const renameButton = screen.getByRole('button', {
      name: 'Rename conversation by id',
    });
    await user.click(renameButton);
    expect(mocks.directInstanceMethods.renameConversation).toHaveBeenCalledWith(
      'conv-1',
      'Renamed',
    );

    const deleteButton = screen.getByRole('button', {
      name: 'Delete conversation by id',
    });
    await user.click(deleteButton);
    expect(mocks.directInstanceMethods.deleteConversation).toHaveBeenCalledWith(
      'conv-1',
    );
  });

  it('re-runs getConversations when Refresh list is clicked', async () => {
    const user = userEvent.setup();
    await renderReady();

    const refreshButton = screen.getByRole('button', {
      name: 'Refresh list',
    });
    await user.click(refreshButton);

    expect(mocks.directInstanceMethods.getConversations).toHaveBeenCalledOnce();
  });

  it('destroys the overlay instance on unmount', () => {
    const { unmount } = render(<ConversationListCase />);
    unmount();

    expect(mocks.directInstanceMethods.destroy).toHaveBeenCalledOnce();
  });
});
