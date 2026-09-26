import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FavoriteSkillItem } from '../../../models/favorite-skill-item';
import type { FavoriteSkillsPanelProps } from '../../../models/favorite-skills-panel-props';
import { FavoriteSkillsPanel } from '../FavoriteSkillsPanel';

const FAVORITES: FavoriteSkillItem[] = [
  { id: 'skills/bucket/alpha', name: 'Alpha' },
  { id: 'skills/bucket/beta', name: 'Beta' },
];

const renderPanel = (props?: Partial<FavoriteSkillsPanelProps>) =>
  render(
    <FavoriteSkillsPanel
      favorites={FAVORITES}
      onSelect={vi.fn()}
      onBrowse={vi.fn()}
      onToggleFavorite={vi.fn()}
      {...props}
    />,
  );

describe('FavoriteSkillsPanel — listbox mode', () => {
  it('renders the rows as options of a listbox named by the header', () => {
    renderPanel({ listboxId: 'skills-listbox', searchQuery: '' });

    const listbox = screen.getByRole('listbox', { name: 'My Collection' });
    expect(listbox.id).toBe('skills-listbox');
    expect(screen.getByRole('option', { name: 'Alpha' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Beta' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Alpha' })).toBeNull();
  });

  it('marks only the active option as selected', () => {
    const { rerender } = renderPanel({
      listboxId: 'skills-listbox',
      searchQuery: '',
    });
    const beta = screen.getByRole('option', { name: 'Beta' });

    rerender(
      <FavoriteSkillsPanel
        favorites={FAVORITES}
        onSelect={vi.fn()}
        onBrowse={vi.fn()}
        listboxId="skills-listbox"
        searchQuery=""
        activeOptionId={beta.id}
      />,
    );

    expect(beta.getAttribute('aria-selected')).toBe('true');
    expect(
      screen
        .getByRole('option', { name: 'Alpha' })
        .getAttribute('aria-selected'),
    ).toBe('false');
  });

  it('keeps the rows tabbable and the star out of the Tab sequence', () => {
    renderPanel({ listboxId: 'skills-listbox', searchQuery: '' });

    expect(
      screen.getByRole('option', { name: 'Alpha' }).getAttribute('tabindex'),
    ).toBe('0');
    screen
      .getAllByRole('button', { name: 'Remove from favorites' })
      .forEach((star) => expect(star.getAttribute('tabindex')).toBe('-1'));
  });

  it('selects a row on click', async () => {
    const onSelect = vi.fn();
    renderPanel({ listboxId: 'skills-listbox', searchQuery: '', onSelect });

    await userEvent.click(screen.getByRole('option', { name: 'Beta' }));

    expect(onSelect).toHaveBeenCalledWith(FAVORITES[1]);
  });
});

describe('FavoriteSkillsPanel — menu mode', () => {
  it('renders the rows and Browse as menu items', () => {
    renderPanel({ isMenu: true });

    expect(screen.getByRole('menuitem', { name: 'Alpha' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Beta' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Browse' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Alpha' })).toBeNull();
  });

  it('keeps listbox mode when both isMenu and listboxId are set', () => {
    renderPanel({ isMenu: true, listboxId: 'skills-listbox', searchQuery: '' });

    expect(screen.getByRole('option', { name: 'Alpha' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Alpha' })).toBeNull();
  });
});

describe('FavoriteSkillsPanel — plain mode', () => {
  it('renders button rows with the star in the Tab sequence', () => {
    renderPanel();

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Alpha' })).toBeTruthy();
    screen
      .getAllByRole('button', { name: 'Remove from favorites' })
      .forEach((star) => expect(star.getAttribute('tabindex')).toBeNull());
  });
});
