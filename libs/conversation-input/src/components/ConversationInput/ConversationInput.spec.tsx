import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConversationInput } from './ConversationInput.js';

describe('ConversationInput', () => {
  it('should render with welcome text', () => {
    render(<ConversationInput welcomeText="How can I help you?" />);
    expect(screen.getByText('How can I help you?')).toBeTruthy();
  });

  it('should keep welcome text visible when typing', () => {
    const { container } = render(
      <ConversationInput welcomeText="How can I help you?" />,
    );
    const textarea = container.querySelector('textarea');

    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'Hello' } });
      expect(screen.getByText('How can I help you?')).toBeTruthy();
    }
  });

  it('should call onSend when send button is clicked', () => {
    const handleSend = vi.fn();
    const { container } = render(<ConversationInput onSend={handleSend} />);

    const textarea = container.querySelector('textarea');

    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.click(screen.getByLabelText('Send message'));

      expect(handleSend).toHaveBeenCalledWith('Test message', []);
    }
  });

  it('should call onSend when Enter is pressed', () => {
    const handleSend = vi.fn();
    const { container } = render(<ConversationInput onSend={handleSend} />);

    const textarea = container.querySelector('textarea');

    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      expect(handleSend).toHaveBeenCalledWith('Test message', []);
    }
  });

  it('should not send empty messages', () => {
    const handleSend = vi.fn();
    render(<ConversationInput onSend={handleSend} />);

    expect(screen.queryByLabelText('Send message')).toBeNull();
    expect(handleSend).not.toHaveBeenCalled();
  });

  it('should hide welcome text when welcomeText prop is empty string', () => {
    render(<ConversationInput welcomeText="" />);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('should not call onSend when Shift+Enter is pressed', () => {
    const handleSend = vi.fn();
    const { container } = render(<ConversationInput onSend={handleSend} />);
    const textarea = container.querySelector('textarea');
    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
      expect(handleSend).not.toHaveBeenCalled();
    }
  });

  it('should seed textarea with initialMessage', () => {
    const { container } = render(
      <ConversationInput message="Prefilled text" />,
    );
    const textarea = container.querySelector('textarea');
    expect(textarea?.value).toBe('Prefilled text');
  });

  it('should forward placeholder to the textarea', () => {
    const { container } = render(
      <ConversationInput placeholder="Ask me anything" />,
    );
    const textarea = container.querySelector('textarea');
    expect(textarea?.placeholder).toBe('Ask me anything');
  });
});
