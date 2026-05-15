import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from '../app';

vi.mock('../../components/Header/Header', () => ({
  default: () => <header data-testid="header" />,
}));

vi.mock('../../components/Navigation/Navigation', () => ({
  default: () => <nav data-testid="navigation" />,
}));

vi.mock('../../components/CatalogView/CatalogView', () => ({
  default: () => <div data-testid="catalog-view">Catalog</div>,
}));

vi.mock('../../components/ConversationView/ConversationView', () => ({
  default: ({ messages }: { messages: Array<{ content: string }> }) => (
    <div data-testid="conversation-view">
      {messages.map((message) => (
        <div key={message.content}>{message.content}</div>
      ))}
    </div>
  ),
}));

vi.mock('../../utils/local-storage', () => ({
  getFromLocalStorage: vi.fn(() => null),
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

const renderApp = (initialPath = '/') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );

describe('App', () => {
  it('renders navigation and header', () => {
    renderApp();
    expect(screen.getByTestId('navigation')).toBeTruthy();
    expect(screen.getByTestId('header')).toBeTruthy();
  });

  it('renders welcome state on root route', async () => {
    renderApp('/');
    expect(await screen.findByText('Welcome to Chat')).toBeTruthy();
    expect(
      await screen.findByPlaceholderText('Type a message...'),
    ).toBeTruthy();
  });

  it('switches to conversation view after send', async () => {
    const user = userEvent.setup();
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Send' }));

    expect(await screen.findByTestId('conversation-view')).toBeTruthy();
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(await screen.findByText('This is a demo response')).toBeTruthy();
  });

  it('renders catalog view on /catalog route', async () => {
    renderApp('/catalog');
    expect(await screen.findByTestId('catalog-view')).toBeTruthy();
  });
});
