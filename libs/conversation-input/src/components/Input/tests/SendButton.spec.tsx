import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SendButton } from '../Buttons/SendButton';

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

  it('should show sendTooltip as a tooltip on hover', async () => {
    render(<SendButton sendTooltip="Type a message first" />);

    await userEvent.hover(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('Type a message first')).toBeTruthy();
  });

  it('should render no tooltip when sendTooltip is unset', async () => {
    render(<SendButton />);

    await userEvent.hover(screen.getByRole('button', { name: 'Send message' }));

    expect(screen.queryByText('Type a message first')).toBeNull();
  });
});
