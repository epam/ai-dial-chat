import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ENTITY_TYPE_COLOR } from '../../../constants/entity-colors';
import { CatalogEntityType } from '../../../types/entity-type';
import { EntityTypeLabel } from '../EntityTypeLabel';

describe('EntityTypeLabel', () => {
  it('renders the type through the uppercasing lead typography class with no background', () => {
    render(<EntityTypeLabel type={CatalogEntityType.Model} />);

    const label = screen.getByText(CatalogEntityType.Model);

    expect(label.className).toContain('dial-caption-lead-semi-text');
    expect(label.className).not.toMatch(/bg-|background/);
  });

  it('renders PROMPT as its own label', () => {
    render(<EntityTypeLabel type={CatalogEntityType.Prompt} />);

    expect(screen.getByText('PROMPT')).toBeTruthy();
  });

  it('has a distinct colour for every entity type it can render', () => {
    const colors = Object.values(CatalogEntityType).map(
      (type) => ENTITY_TYPE_COLOR[type],
    );

    expect(colors.every(Boolean)).toBe(true);
    expect(new Set(colors).size).toBe(colors.length);
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
