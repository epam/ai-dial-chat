import { describe, expect, it } from 'vitest';
import type { ProjectItem } from '../../models/project-item';
import { ProjectSource } from '../../types/project-source';
import { ProjectsSortKey } from '../../types/projects-sort-key';
import { filterProjects, sortProjects } from '../projects';

const project = (
  name: string,
  updatedAt?: number,
  isPinned?: boolean,
): ProjectItem => ({
  id: name,
  name,
  source: ProjectSource.Personal,
  updatedAt,
  isPinned,
});

const names = (projects: ProjectItem[]) => projects.map((item) => item.name);

describe('filterProjects', () => {
  const projects = [
    project('Q4 Launch'),
    project('Handbook'),
    project('Launch retro'),
  ];

  it('keeps projects whose name contains the query, ignoring case', () => {
    expect(names(filterProjects(projects, 'launch'))).toEqual([
      'Q4 Launch',
      'Launch retro',
    ]);
  });

  it('trims the query before matching', () => {
    expect(names(filterProjects(projects, '  hand  '))).toEqual(['Handbook']);
  });

  it('returns every project for a whitespace-only query', () => {
    expect(filterProjects(projects, '   ')).toBe(projects);
  });

  it('returns nothing when no name matches', () => {
    expect(filterProjects(projects, 'zzz')).toEqual([]);
  });
});

describe('sortProjects', () => {
  it('orders Newest by updatedAt descending', () => {
    const projects = [project('a', 1), project('b', 3), project('c', 2)];
    expect(names(sortProjects(projects, ProjectsSortKey.Newest))).toEqual([
      'b',
      'c',
      'a',
    ]);
  });

  it('orders Oldest by updatedAt ascending and keeps undated projects last', () => {
    const projects = [project('t2', 2), project('undated'), project('t1', 1)];
    expect(names(sortProjects(projects, ProjectsSortKey.Oldest))).toEqual([
      't1',
      't2',
      'undated',
    ]);
  });

  it('keeps undated projects last in the Newest order too', () => {
    const projects = [project('undated'), project('t1', 1)];
    expect(names(sortProjects(projects, ProjectsSortKey.Newest))).toEqual([
      't1',
      'undated',
    ]);
  });

  it('breaks date ties by name', () => {
    const projects = [project('beta', 5), project('alpha', 5)];
    expect(names(sortProjects(projects, ProjectsSortKey.Newest))).toEqual([
      'alpha',
      'beta',
    ]);
  });

  it('orders Name A–Z case-insensitively with numeric collation', () => {
    const projects = [
      project('beta'),
      project('alpha 10'),
      project('Alpha'),
      project('alpha 9'),
    ];
    expect(
      names(sortProjects(projects, ProjectsSortKey.NameAsc, 'en')),
    ).toEqual(['Alpha', 'alpha 9', 'alpha 10', 'beta']);
  });

  it('does not mutate the input array', () => {
    const projects = [project('b', 1), project('a', 2)];
    sortProjects(projects, ProjectsSortKey.NameAsc);
    expect(names(projects)).toEqual(['b', 'a']);
  });

  it('puts pinned projects first in a date order', () => {
    const projects = [
      project('a', 3),
      project('b', 1, true),
      project('c', 2, true),
    ];
    expect(names(sortProjects(projects, ProjectsSortKey.Newest))).toEqual([
      'c',
      'b',
      'a',
    ]);
  });

  it('puts pinned projects first in Name A–Z', () => {
    const projects = [project('alpha'), project('zeta', undefined, true)];
    expect(
      names(sortProjects(projects, ProjectsSortKey.NameAsc, 'en')),
    ).toEqual(['zeta', 'alpha']);
  });
});
