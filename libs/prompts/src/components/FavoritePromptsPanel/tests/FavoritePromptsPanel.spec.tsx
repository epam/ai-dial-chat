import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { FavoritePromptItem } from '../../../models/favorite-prompt-item';
import { FavoritePromptsPanel } from '../FavoritePromptsPanel';

const makeItem = (
  overrides: Partial<FavoritePromptItem> = {},
): FavoritePromptItem => ({
  id: 'prompt-1',
  name: 'Summarizer',
  content: 'Summarize: {{text}}',
  ...overrides,
});

const renderPanel = (
  props?: Partial<ComponentProps<typeof FavoritePromptsPanel>>,
) =>
  render(
    <FavoritePromptsPanel
      favorites={[]}
      onSelect={vi.fn()}
      onToggleFavorite={vi.fn()}
      onBrowse={vi.fn()}
      {...props}
    />,
  );

describe('FavoritePromptsPanel', () => {
  it('renders the "My Collection" header', () => {
    renderPanel();

    expect(screen.getByText('My Collection')).toBeTruthy();
  });

  it('shows the empty-state hint when there are no favorites', () => {
    renderPanel({ favorites: [] });

    expect(screen.getByText('Star a prompt to pin it here')).toBeTruthy();
  });

  it('shows the "Browse" button even when there are no favorites', () => {
    renderPanel({ favorites: [] });

    expect(screen.getByRole('button', { name: 'Browse' })).toBeTruthy();
  });

  it('renders a favorite row with its name and a pressed star toggle', () => {
    renderPanel({ favorites: [makeItem()] });

    expect(screen.getByText('Summarizer')).toBeTruthy();
    const star = screen.getByRole('button', { name: 'Remove from favorites' });
    expect(star.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onSelect with the item when a row is clicked', async () => {
    const onSelect = vi.fn();
    const item = makeItem();
    renderPanel({ favorites: [item], onSelect });

    await userEvent.click(screen.getByText('Summarizer'));

    expect(onSelect).toHaveBeenCalledWith(item);
  });

  it('calls onToggleFavorite with the id when the star is clicked', async () => {
    const onToggleFavorite = vi.fn();
    renderPanel({
      favorites: [makeItem({ id: 'prompt-2' })],
      onToggleFavorite,
    });

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove from favorites' }),
    );

    expect(onToggleFavorite).toHaveBeenCalledWith('prompt-2');
  });

  it('calls onBrowse when "Browse" is clicked', async () => {
    const onBrowse = vi.fn();
    renderPanel({ onBrowse });

    await userEvent.click(screen.getByRole('button', { name: 'Browse' }));

    expect(onBrowse).toHaveBeenCalledOnce();
  });

  it('shows the description in a tooltip trigger when present', () => {
    renderPanel({
      favorites: [makeItem({ description: 'Summarizes long text' })],
    });

    expect(screen.getByText('Summarizer')).toBeTruthy();
  });
});
