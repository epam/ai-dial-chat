import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EntityHeaderItem } from '../../../models/entity';
import { CatalogEntityType } from '../../../types/entity-type';
import { ResourceSummary } from '../ResourceSummary';

const item: EntityHeaderItem = {
  type: CatalogEntityType.Model,
  name: 'ali.deepseek-v4-flash',
  version: '4.0.1',
};

describe('ResourceSummary', () => {
  it('renders the entity type label', () => {
    render(<ResourceSummary item={item} />);
    expect(screen.getByText(CatalogEntityType.Model)).toBeTruthy();
  });

  it('substitutes the version into the default version tag label', () => {
    render(<ResourceSummary item={item} />);
    expect(screen.getByText('Version 4.0.1 · current')).toBeTruthy();
  });

  it('substitutes the version into a caller-supplied label', () => {
    render(<ResourceSummary item={item} versionLabel="v{version} in use" />);
    expect(screen.getByText('v4.0.1 in use')).toBeTruthy();
  });

  it('omits the version tag when hasVersionTag is false', () => {
    render(<ResourceSummary item={item} hasVersionTag={false} />);
    expect(screen.queryByText(/current/)).toBeNull();
  });

  it('renders custom children in place of the entity summary', () => {
    render(
      <ResourceSummary item={item}>
        <span>Q3 planning notes</span>
      </ResourceSummary>,
    );
    expect(screen.getByText('Q3 planning notes')).toBeTruthy();
    expect(screen.queryByText(CatalogEntityType.Model)).toBeNull();
  });

  it('omits the version tag for an unversioned resource', () => {
    render(<ResourceSummary item={{ ...item, version: '' }} />);
    expect(screen.queryByText(/current/)).toBeNull();
  });
});
