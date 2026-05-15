import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as ThemeContext from '../../context/ThemeContext';
import App from '../app';

// Mock modules
vi.mock('../../context/ThemeContext');
vi.mock('../../components/ConversationView/ConversationView', () => ({
  default: ({ messages }: { messages: Array<{ content: string }> }) => (
    <div data-testid="conversation-view">
      {messages.map((message) => (
        <div key={`${message.content}`}>{message.content}</div>
      ))}
    </div>
  ),
}));

vi.mock('@epam/conversation-input', () => ({
  ConversationInput: ({
    onSend,
    welcomeText,
    placeholder,
  }: {
    onSend: (message: string) => void;
    welcomeText: string;
    placeholder: string;
  }) => (
    <div>
      <div>{welcomeText}</div>
      <textarea placeholder={placeholder} aria-label="message-input" />
      <button type="button" onClick={() => onSend('Hello')}>
        Send
      </button>
    </div>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'chat.welcomeText': 'Welcome to Chat',
        'chat.placeholder': 'Type a message...',
        'chat.demoResponse': 'This is a demo response',
      };
      return translations[key] || key;
    },
  }),
}));

describe('App', () => {
  const mockUseTheme = vi.mocked(ThemeContext.useTheme);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      currentThemeLogo: 'logo.svg',
      themes: [],
      setTheme: vi.fn(),
      isLoading: false,
    });
  });

  it('should render successfully', () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });

  it('should render welcome screen when no messages', async () => {
    render(<App />);

    expect(await screen.findByText('Welcome to Chat')).toBeTruthy();
  });

  it('should render Header component', () => {
    const { container } = render(<App />);

    const header = container.querySelector('header');
    expect(header).toBeTruthy();
  });

  it('should render ConversationInput with welcome text', async () => {
    render(<App />);

    expect(await screen.findByText('Welcome to Chat')).toBeTruthy();
  });

  it('should add user message when onSend is called', async () => {
    const user = userEvent.setup();
    render(<App />);

    const sendButton = await screen.findByRole('button', { name: 'Send' });
    await user.click(sendButton);

    expect(await screen.findByTestId('conversation-view')).toBeTruthy();
    expect(screen.getByText('Hello')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('This is a demo response')).toBeTruthy();
    });
  });

  it('should render conversation view when messages exist', async () => {
    const user = userEvent.setup();
    render(<App />);

    const sendButton = await screen.findByRole('button', { name: 'Send' });
    await user.click(sendButton);

    expect(await screen.findByTestId('conversation-view')).toBeTruthy();
  });

  it('should apply correct layout classes', () => {
    const { container } = render(<App />);

    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer.classList.contains('flex')).toBe(true);
    expect(mainContainer.classList.contains('size-full')).toBe(true);
    expect(mainContainer.classList.contains('flex-col')).toBe(true);
  });

  it('should render placeholder text from i18n', async () => {
    render(<App />);

    const placeholder = await screen.findByPlaceholderText('Type a message...');
    expect(placeholder).toBeTruthy();
  });

  it('should use i18n for welcome text', async () => {
    render(<App />);

    expect(await screen.findByText('Welcome to Chat')).toBeTruthy();
  });

  it('should have scrollable message container structure', () => {
    const { container } = render(<App />);

    const flexContainer = container.querySelector('.flex-1');
    expect(flexContainer).toBeTruthy();
  });

  it('should center ConversationInput in welcome state', () => {
    const { container } = render(<App />);

    const centerContainer = container.querySelector(
      '.items-center.justify-center',
    );
    expect(centerContainer).toBeTruthy();
  });
});
