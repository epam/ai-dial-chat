import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectsLabels } from '../../../models/projects-props';
import { ProjectSource } from '../../../types/project-source';
import { ProjectsSortKey } from '../../../types/projects-sort-key';
import { Projects } from '../Projects';

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return { ...actual, useIsMobile: () => true };
});

const labels: ProjectsLabels = {
  title: 'Projects',
  subtitle: 'All projects available to you',
  searchPlaceholder: 'Search projects',
  searchAriaLabel: 'Search projects',
  clearSearchLabel: 'Clear search',
  sortLabel: 'Sort',
  sortOptions: [{ value: ProjectsSortKey.Newest, label: 'Newest' }],
  emptyStateLabel: 'No projects yet',
  noResultsLabel: 'No matching projects',
  errorLabel: 'Projects could not be loaded',
  incompleteLabel: 'Some projects could not be loaded',
  retryLabel: 'Retry',
  sourceLabels: {
    [ProjectSource.Personal]: 'Personal',
    [ProjectSource.Shared]: 'Shared',
    [ProjectSource.Organization]: 'Organization',
  },
  resultCountLabel: (count) => `${count} projects`,
  folderPathLabel: 'Project location',
  createProjectLabel: 'New project',
};

const renderProjects = (onCreateProject?: () => void) =>
  render(
    <Projects
      projects={[
        { id: 'p1', name: 'Q4 Launch', source: ProjectSource.Personal },
      ]}
      onRetry={vi.fn()}
      onCreateProject={onCreateProject}
      searchQuery=""
      onSearchQueryChange={vi.fn()}
      sortKey={ProjectsSortKey.Newest}
      onSortKeyChange={vi.fn()}
      labels={labels}
      locale="en"
    />,
  );

describe('Projects on mobile', () => {
  it('keeps the title for assistive tech only and drops the subtitle', () => {
    renderProjects();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Projects' }).className,
    ).toContain('sr-only');
    expect(screen.queryByText('All projects available to you')).toBeNull();
  });

  it('replaces the header button with one floating New project button', async () => {
    const onCreateProject = vi.fn();
    renderProjects(onCreateProject);

    const buttons = screen.getAllByRole('button', { name: 'New project' });
    expect(buttons).toHaveLength(1);

    await userEvent.click(buttons[0]);
    expect(onCreateProject).toHaveBeenCalledOnce();
  });

  it('renders no floating button without onCreateProject', () => {
    renderProjects();

    expect(screen.queryByRole('button', { name: 'New project' })).toBeNull();
  });
});
