import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SendButton } from '../Buttons/SendButton.js';

describe('SendButton', () => {
  it('should call onSend when clicked', () => {
    const handleSend = vi.fn();
    render(<SendButton onSend={handleSend} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(handleSend).toHaveBeenCalledTimes(1);
  });

  it('should render a button with aria-label "Send message"', () => {
    render(<SendButton />);
    expect(screen.getByRole('button', { name: 'Send message' })).toBeTruthy();
  });
});
