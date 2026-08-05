import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CatalogEntityType } from '../../../types/entity-type';
import { EntityTypeLabel } from '../EntityTypeLabel';

describe('EntityTypeLabel', () => {
  it('renders the type as uppercase text with no background', () => {
    const { container } = render(
      <EntityTypeLabel type={CatalogEntityType.Model} />,
    );

    expect(screen.getByText(CatalogEntityType.Model)).toBeTruthy();
    expect(container.querySelector('span')?.className).toContain('uppercase');
    expect(container.querySelector('span')?.className).not.toMatch(
      /bg-|background/,
    );
  });

  it('merges a custom className with the default uppercase/tracking classes', () => {
    render(
      <EntityTypeLabel type={CatalogEntityType.Agent} className="custom-cls" />,
    );

    expect(screen.getByText(CatalogEntityType.Agent).className).toContain(
      'custom-cls',
    );
  });
});
