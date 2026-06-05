import { MessageRating, MessageRole } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MessageActions } from './MessageActions.js';

describe('MessageActions', () => {
  describe('role=User (default)', () => {
    it('renders Edit and Delete buttons', () => {
      render(<MessageActions />);
      expect(screen.getByRole('button', { name: 'Edit message' })).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Delete message' }),
      ).toBeTruthy();
    });

    it('does not render Agent action buttons', () => {
      render(<MessageActions />);
      expect(
        screen.queryByRole('button', { name: 'Regenerate response' }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Copy response' }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Copy as markdown' }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Like response' }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Dislike response' }),
      ).toBeNull();
    });

    it('calls onEdit when Edit button is clicked', async () => {
      const onEdit = vi.fn();
      const user = userEvent.setup();
      render(<MessageActions onEdit={onEdit} />);
      await user.click(screen.getByRole('button', { name: 'Edit message' }));
      expect(onEdit).toHaveBeenCalledOnce();
    });

    it('calls onDelete when Delete button is clicked', async () => {
      const onDelete = vi.fn();
      const user = userEvent.setup();
      render(<MessageActions onDelete={onDelete} />);
      await user.click(screen.getByRole('button', { name: 'Delete message' }));
      expect(onDelete).toHaveBeenCalledOnce();
    });
  });

  describe('role=Assistant', () => {
    it('renders Regenerate, Copy, Markdown, Like, and Dislike buttons', () => {
      render(
        <MessageActions
          role={MessageRole.Assistant}
          onRegenerate={vi.fn()}
          onCopy={vi.fn()}
          onCopyMarkdown={vi.fn()}
          onLike={vi.fn()}
          onDislike={vi.fn()}
        />,
      );
      expect(
        screen.getByRole('button', { name: 'Regenerate response' }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Copy response' }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Copy as markdown' }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Like response' }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Dislike response' }),
      ).toBeTruthy();
    });

    it('does not render User action buttons', () => {
      render(<MessageActions role={MessageRole.Assistant} />);
      expect(screen.queryByRole('button', { name: 'Edit message' })).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Delete message' }),
      ).toBeNull();
    });

    it('calls onRegenerate when Regenerate button is clicked', async () => {
      const onRegenerate = vi.fn();
      const user = userEvent.setup();
      render(
        <MessageActions
          role={MessageRole.Assistant}
          onRegenerate={onRegenerate}
        />,
      );
      await user.click(
        screen.getByRole('button', { name: 'Regenerate response' }),
      );
      expect(onRegenerate).toHaveBeenCalledOnce();
    });

    it('calls onCopy when Copy button is clicked', async () => {
      const onCopy = vi.fn();
      const user = userEvent.setup();
      render(<MessageActions role={MessageRole.Assistant} onCopy={onCopy} />);
      await user.click(screen.getByRole('button', { name: 'Copy response' }));
      expect(onCopy).toHaveBeenCalledOnce();
    });

    it('calls onCopyMarkdown when Markdown button is clicked', async () => {
      const onCopyMarkdown = vi.fn();
      const user = userEvent.setup();
      render(
        <MessageActions
          role={MessageRole.Assistant}
          onCopyMarkdown={onCopyMarkdown}
        />,
      );
      await user.click(
        screen.getByRole('button', { name: 'Copy as markdown' }),
      );
      expect(onCopyMarkdown).toHaveBeenCalledOnce();
    });

    it('calls onLike when Like button is clicked', async () => {
      const onLike = vi.fn();
      const user = userEvent.setup();
      render(<MessageActions role={MessageRole.Assistant} onLike={onLike} />);
      await user.click(screen.getByRole('button', { name: 'Like response' }));
      expect(onLike).toHaveBeenCalledOnce();
    });

    it('calls onDislike when Dislike button is clicked', async () => {
      const onDislike = vi.fn();
      const user = userEvent.setup();
      render(
        <MessageActions role={MessageRole.Assistant} onDislike={onDislike} />,
      );
      await user.click(
        screen.getByRole('button', { name: 'Dislike response' }),
      );
      expect(onDislike).toHaveBeenCalledOnce();
    });
  });

  it('merges additional className onto the wrapper element', () => {
    const { container } = render(
      <MessageActions className="my-custom-class" />,
    );
    expect(container.firstElementChild?.className).toContain('my-custom-class');
  });

  it('hides actions by default (opacity-0)', () => {
    const { container } = render(<MessageActions />);
    expect(container.firstElementChild?.className).toContain('opacity-0');
  });

  it('does not apply opacity-0 when isAlwaysVisible is true', () => {
    const { container } = render(<MessageActions isAlwaysVisible />);
    expect(container.firstElementChild?.className).not.toContain('opacity-0');
  });

  describe('activeRating', () => {
    it('highlights the Like button when activeRating is Like (1)', () => {
      render(
        <MessageActions
          role={MessageRole.Assistant}
          activeRating={MessageRating.Like}
          onLike={vi.fn()}
          onDislike={vi.fn()}
        />,
      );
      const likeBtn = screen.getByRole('button', { name: 'Like response' });
      expect(likeBtn.className).toContain('text-accent-primary');
    });

    it('does not highlight the Dislike button when activeRating is Like (1)', () => {
      render(
        <MessageActions
          role={MessageRole.Assistant}
          activeRating={MessageRating.Like}
          onLike={vi.fn()}
          onDislike={vi.fn()}
        />,
      );
      const dislikeBtn = screen.getByRole('button', {
        name: 'Dislike response',
      });
      expect(dislikeBtn.className).not.toContain('text-accent-primary');
    });

    it('highlights the Dislike button when activeRating is Dislike (-1)', () => {
      render(
        <MessageActions
          role={MessageRole.Assistant}
          activeRating={MessageRating.Dislike}
          onLike={vi.fn()}
          onDislike={vi.fn()}
        />,
      );
      const dislikeBtn = screen.getByRole('button', {
        name: 'Dislike response',
      });
      expect(dislikeBtn.className).toContain('text-accent-primary');
    });

    it('does not highlight the Like button when activeRating is Dislike (-1)', () => {
      render(
        <MessageActions
          role={MessageRole.Assistant}
          activeRating={MessageRating.Dislike}
          onLike={vi.fn()}
          onDislike={vi.fn()}
        />,
      );
      const likeBtn = screen.getByRole('button', { name: 'Like response' });
      expect(likeBtn.className).not.toContain('text-accent-primary');
    });

    it('does not highlight either button when activeRating is undefined', () => {
      render(
        <MessageActions
          role={MessageRole.Assistant}
          onLike={vi.fn()}
          onDislike={vi.fn()}
        />,
      );
      const likeBtn = screen.getByRole('button', { name: 'Like response' });
      const dislikeBtn = screen.getByRole('button', {
        name: 'Dislike response',
      });
      expect(likeBtn.className).not.toContain('text-accent-primary');
      expect(dislikeBtn.className).not.toContain('text-accent-primary');
    });
  });
});
