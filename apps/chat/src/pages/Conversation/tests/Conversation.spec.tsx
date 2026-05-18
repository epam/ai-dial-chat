import { MessageRole, type Conversation } from '@epam/chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FC } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../../../constants/routes';
import { useConversation } from '../../../context/ConversationContext';
import ConversationPage from '../Conversation';

const mockSendMessage = vi.fn();
const mockNavigate = vi.fn();

const knownConversation: Conversation = {
  id: 'conv-abc',
  messages: [
    {
      id: 'msg-1',
      role: MessageRole.User,
      content: 'Hello there',
      timestamp: '2024-01-01T00:00:00.000Z',
    },
  ],
  createdAt: '2024-01-01T00:00:00.000Z',
};

vi.mock('../../../context/ConversationContext', () => ({
  useConversation: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const WithRoute: FC<{ id: string }> = ({ id }) => (
  <MemoryRouter initialEntries={[`${ROUTES.CONVERSATIONS}/${id}`]}>
    <Routes>
      <Route
        path="/conversations/:conversationId"
        element={<ConversationPage />}
      />
    </Routes>
  </MemoryRouter>
);

describe('ConversationPage', () => {
  it('renders the conversation view for a known conversation ID', () => {
    vi.mocked(useConversation).mockReturnValue({
      conversations: new Map([['conv-abc', knownConversation]]),
      createConversation: vi.fn(),
      sendMessage: mockSendMessage,
    });

    render(<WithRoute id="conv-abc" />);

    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('navigates to root when conversation is not found', () => {
    vi.mocked(useConversation).mockReturnValue({
      conversations: new Map(),
      createConversation: vi.fn(),
      sendMessage: mockSendMessage,
    });

    render(<WithRoute id="does-not-exist" />);

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.ROOT);
  });

  it('calls sendMessage when the user submits a message', async () => {
    vi.mocked(useConversation).mockReturnValue({
      conversations: new Map([['conv-abc', knownConversation]]),
      createConversation: vi.fn(),
      sendMessage: mockSendMessage,
    });

    render(<WithRoute id="conv-abc" />);

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'New message');
    await userEvent.keyboard('{Enter}');

    expect(mockSendMessage).toHaveBeenCalledWith('conv-abc', 'New message');
  });
});
