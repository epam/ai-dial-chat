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
    const button = container.querySelector('button');

    if (textarea && button) {
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.click(button);

      expect(handleSend).toHaveBeenCalledWith('Test message');
    }
  });

  it('should call onSend when Enter is pressed', () => {
    const handleSend = vi.fn();
    const { container } = render(<ConversationInput onSend={handleSend} />);

    const textarea = container.querySelector('textarea');

    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      expect(handleSend).toHaveBeenCalledWith('Test message');
    }
  });

  it('should not send empty messages', () => {
    const handleSend = vi.fn();
    const { container } = render(<ConversationInput onSend={handleSend} />);

    const button = container.querySelector('button');

    if (button) {
      fireEvent.click(button);
      expect(handleSend).not.toHaveBeenCalled();
    }
  });

  it('should hide welcome text when welcomeText prop is empty string', () => {
    render(<ConversationInput welcomeText="" />);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('should not call onSend when disabled and Enter is pressed', () => {
    const handleSend = vi.fn();
    const { container } = render(
      <ConversationInput onSend={handleSend} disabled initialMessage="Hello" />,
    );
    const textarea = container.querySelector('textarea');
    if (textarea) {
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
      expect(handleSend).not.toHaveBeenCalled();
    }
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
      <ConversationInput initialMessage="Prefilled text" />,
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
