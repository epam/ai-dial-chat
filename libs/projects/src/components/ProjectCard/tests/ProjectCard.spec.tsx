import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
        formatUpdatedAt={() => 'Updated Mar 1, 2026'}
        titleClassName="dial-body-semi-text"
        badgeClassName="dial-tiny-semi-text"
        metaClassName="dial-small-text"
        {...overrides}
      />
    </ul>,
  );

describe('ProjectCard', () => {
  it('renders the name, the source label and the formatted date', () => {
    renderCard();

    expect(screen.getByRole('listitem')).toBeTruthy();
    expect(screen.getAllByText('Handbook').length).toBeGreaterThan(0);
    expect(screen.getByText('Organization')).toBeTruthy();
    expect(screen.getByText('Updated Mar 1, 2026').tagName).toBe('TIME');
  });

  it('exposes the machine-readable timestamp on the time element', () => {
    renderCard();

    expect(
      screen.getByText('Updated Mar 1, 2026').getAttribute('dateTime'),
    ).toBe('2026-03-01T00:00:00.000Z');
  });

  it('renders no date when the project has no update time', () => {
    renderCard({
      project: { id: 'p2', name: 'Draft', source: ProjectSource.Personal },
    });

    expect(screen.queryByText('Updated Mar 1, 2026')).toBeNull();
  });

  it('is not interactive', () => {
    renderCard();

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
