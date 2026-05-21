import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MessageActions } from './MessageActions.js';

describe('MessageActions', () => {
  describe('source="User" (default)', () => {
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
        screen.queryByRole('button', { name: 'Toggle markdown' }),
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
      render(<MessageActions onEdit={onEdit} />);
      await userEvent.click(
        screen.getByRole('button', { name: 'Edit message' }),
      );
      expect(onEdit).toHaveBeenCalledOnce();
    });

    it('calls onDelete when Delete button is clicked', async () => {
      const onDelete = vi.fn();
      render(<MessageActions onDelete={onDelete} />);
      await userEvent.click(
        screen.getByRole('button', { name: 'Delete message' }),
      );
      expect(onDelete).toHaveBeenCalledOnce();
    });
  });

  describe('source="Agent"', () => {
    it('renders Regenerate, Copy, Markdown, Like, and Dislike buttons', () => {
      render(<MessageActions role="Agent" />);
      expect(
        screen.getByRole('button', { name: 'Regenerate response' }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Copy response' }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Toggle markdown' }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Like response' }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Dislike response' }),
      ).toBeTruthy();
    });

    it('does not render User action buttons', () => {
      render(<MessageActions role="Agent" />);
      expect(screen.queryByRole('button', { name: 'Edit message' })).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Delete message' }),
      ).toBeNull();
    });

    it('calls onRegenerate when Regenerate button is clicked', async () => {
      const onRegenerate = vi.fn();
      render(<MessageActions role="Agent" onRegenerate={onRegenerate} />);
      await userEvent.click(
        screen.getByRole('button', { name: 'Regenerate response' }),
      );
      expect(onRegenerate).toHaveBeenCalledOnce();
    });

    it('calls onCopy when Copy button is clicked', async () => {
      const onCopy = vi.fn();
      render(<MessageActions role="Agent" onCopy={onCopy} />);
      await userEvent.click(
        screen.getByRole('button', { name: 'Copy response' }),
      );
      expect(onCopy).toHaveBeenCalledOnce();
    });

    it('calls onToggleMarkdown when Markdown button is clicked', async () => {
      const onToggleMarkdown = vi.fn();
      render(
        <MessageActions role="Agent" onToggleMarkdown={onToggleMarkdown} />,
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Toggle markdown' }),
      );
      expect(onToggleMarkdown).toHaveBeenCalledOnce();
    });

    it('calls onLike when Like button is clicked', async () => {
      const onLike = vi.fn();
      render(<MessageActions role="Agent" onLike={onLike} />);
      await userEvent.click(
        screen.getByRole('button', { name: 'Like response' }),
      );
      expect(onLike).toHaveBeenCalledOnce();
    });

    it('calls onDislike when Dislike button is clicked', async () => {
      const onDislike = vi.fn();
      render(<MessageActions role="Agent" onDislike={onDislike} />);
      await userEvent.click(
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

  it('does not apply opacity-0 when alwaysVisible is true', () => {
    const { container } = render(<MessageActions alwaysVisible />);
    expect(container.firstElementChild?.className).not.toContain('opacity-0');
  });
});
