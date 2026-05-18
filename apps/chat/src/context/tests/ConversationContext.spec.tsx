import type { Conversation } from '@epam/chat-shared';
import { render, screen, act, waitFor } from '@testing-library/react';
import { FC } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createConversation as apiCreateConversation } from '../../server-api/conversations.api';
import { ConversationProvider, useConversation } from '../ConversationContext';

vi.mock('../../server-api/conversations.api', () => ({
  createConversation: vi.fn(),
}));

const mockConversation: Conversation = {
  id: 'conv-123',
  messages: [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      timestamp: '2024-01-01T00:00:00.000Z',
    },
  ],
  createdAt: '2024-01-01T00:00:00.000Z',
};

const ConsumerComponent: FC<{ onId?: (id: string) => void }> = ({ onId }) => {
  const { conversations, createConversation, sendMessage } = useConversation();
  return (
    <div>
      <span data-id="count">{conversations.size}</span>
      <button
        onClick={async () => {
          const id = await createConversation('Hello');
          onId?.(id);
        }}
      >
        create
      </button>
      <button onClick={() => sendMessage('conv-123', 'Second')}>send</button>
    </div>
  );
};

describe('ConversationContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createConversation stores the conversation returned by the API', async () => {
    vi.mocked(apiCreateConversation).mockResolvedValue(mockConversation);
    const onId = vi.fn();

    render(
      <ConversationProvider>
        <ConsumerComponent onId={onId} />
      </ConversationProvider>,
    );

    await act(async () => {
      screen.getByRole('button', { name: 'create' }).click();
    });

    await waitFor(() => {
      expect(onId).toHaveBeenCalledWith('conv-123');
    });
  });

  it('sendMessage appends a user message and a simulated assistant response', async () => {
    vi.mocked(apiCreateConversation).mockResolvedValue(mockConversation);
    vi.useFakeTimers();

    const MessageList: FC = () => {
      const { conversations } = useConversation();
      const conv = conversations.get('conv-123');
      return (
        <ul>
          {conv?.messages.map((m) => (
            <li key={m.id}>
              {m.role}: {m.content}
            </li>
          ))}
        </ul>
      );
    };

    render(
      <ConversationProvider>
        <ConsumerComponent />
        <MessageList />
      </ConversationProvider>,
    );

    await act(async () => {
      screen.getByRole('button', { name: 'create' }).click();
    });

    await act(async () => {
      screen.getByRole('button', { name: 'send' }).click();
    });

    expect(screen.getByText(/user: Second/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText(/assistant:/)).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('useConversation throws when used outside ConversationProvider', () => {
    const BrokenComponent: FC = () => {
      useConversation();
      return null;
    };

    expect(() => render(<BrokenComponent />)).toThrow(
      'useConversation must be used within a ConversationProvider',
    );
  });
});
