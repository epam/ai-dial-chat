import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CONVERSATION_PANEL_CLASS } from '../../../constants/public-class-names';
import { NewChatButton } from '../NewChatButton';

const renderButton = (className?: string) =>
  render(
    <NewChatButton label="New chat" onClick={vi.fn()} className={className} />,
  );

const getButton = () => screen.getByRole('button', { name: /New chat/ });

describe('NewChatButton', () => {
  it('calls onClick when activated', async () => {
    const user = userEvent.setup({ delay: null });
    const onClick = vi.fn();
    render(<NewChatButton label="New chat" onClick={onClick} />);

    await user.click(getButton());

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('keeps its own height and elevation when the host passes no class', () => {
    renderButton();

    expect(getButton().classList).toContain('h-[36px]');
    expect(getButton().classList).toContain('shadow-chat-button');
  });

  it('lets a host class replace the height and the elevation', () => {
    renderButton('h-[44px] shadow-md');

    const button = getButton();

    expect(button.classList).toContain('h-[44px]');
    expect(button.classList).toContain('shadow-md');
    expect(button.classList).not.toContain('h-[36px]');
    expect(button.classList).not.toContain('shadow-chat-button');
  });

  it('keeps the public class while the host styles the button', () => {
    renderButton('h-[44px]');

    expect(getButton().classList).toContain(
      CONVERSATION_PANEL_CLASS.newChatButton,
    );
  });
});
