import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectSource } from '../../../types/project-source';
import { ProjectCard, type ProjectCardProps } from '../ProjectCard';

const renderCard = (overrides: Partial<ProjectCardProps> = {}) =>
  render(
    <ul>
      <ProjectCard
        project={{
          id: 'p1',
          name: 'Handbook',
          source: ProjectSource.Organization,
          updatedAt: Date.UTC(2026, 2, 1),
        }}
        searchQuery=""
        sourceLabel="Organization"
        folderPathLabel="Project location"
        pinnedLabel="Pinned"
        pinLabel="Pin"
        now={Date.UTC(2026, 2, 4)}
        locale="en"
        updatedAtClassName="dial-tiny-text"
        titleClassName="dial-body-semi-text"
        pathLabelClassName="dial-tiny-text"
        pathLeafClassName="dial-tiny-semi-text"
        {...overrides}
      />
    </ul>,
  );

describe('ProjectCard', () => {
  it('renders the name on a card named by the project', () => {
    renderCard();

    const card = screen.getByRole('article', { name: 'Handbook' });
    expect(within(card).getAllByText('Handbook').length).toBeGreaterThan(0);
  });

  it('shows the source as the folder path of a root project', () => {
    renderCard();

    const path = screen.getByRole('navigation', { name: 'Project location' });
    expect(within(path).getByText('Organization')).toBeTruthy();
  });

  it('appends the grouping folders after the source for a nested project', () => {
    renderCard({
      project: {
        id: 'p2',
        name: 'Q4 launch',
        source: ProjectSource.Personal,
        parentPath: 'marketing/2026',
      },
      sourceLabel: 'Personal',
    });

    const path = screen.getByRole('navigation', { name: 'Project location' });
    expect(path.textContent).toContain('Personal');
    expect(path.textContent).toContain('marketing');
    expect(path.textContent).toContain('2026');
  });

  it('shows the last-updated time relative to now and no source badge', () => {
    renderCard();

    const time = screen.getByRole('time');
    expect(time.textContent).toBe('3 days ago');
    expect(time.getAttribute('datetime')).toBe('2026-03-01T00:00:00.000Z');
    expect(screen.getAllByText('Organization')).toHaveLength(1);
  });

  it('shows no time for an undated project', () => {
    renderCard({
      project: {
        id: 'p3',
        name: 'Draft',
        source: ProjectSource.Personal,
      },
    });

    expect(screen.queryByRole('time')).toBeNull();
  });

  it('is not interactive', () => {
    renderCard();

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  describe('ProjectCard — pin toggle', () => {
    it('offers a pressed toggle on a pinned card and unpins it', async () => {
      const onTogglePin = vi.fn();
      renderCard({
        project: {
          id: 'p1',
          name: 'Handbook',
          source: ProjectSource.Organization,
          isPinned: true,
        },
        onTogglePin,
      });

      const toggle = screen.getByRole('button', { name: 'Pin' });
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      expect(screen.queryByText('Pinned')).toBeNull();

      await userEvent.click(toggle);
      expect(onTogglePin).toHaveBeenCalledWith('p1', false);
    });

    it('pins an unpinned card without following its link', async () => {
      const onTogglePin = vi.fn();
      const onOpen = vi.fn();
      renderCard({ onTogglePin, onOpen, href: '/projects/view/p1' });

      const toggle = screen.getByRole('button', { name: 'Pin' });
      expect(toggle.getAttribute('aria-pressed')).toBe('false');

      await userEvent.click(toggle);
      expect(onTogglePin).toHaveBeenCalledWith('p1', true);
      expect(onOpen).not.toHaveBeenCalled();
    });

    it('shows no toggle without onTogglePin', () => {
      renderCard();

      expect(screen.queryByRole('button', { name: 'Pin' })).toBeNull();
    });
  });
});
