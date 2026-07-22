import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ENTITY_TYPE_COLOR } from '../../../constants/entity-colors';
import { CatalogEntityType } from '../../../types/entity-type';
import { EntityTypeLabel } from '../EntityTypeLabel';

/**
 * jsdom normalizes a plain hex color to `rgb(r, g, b)` when read back via
 * `el.style.color`.
 */
const toExpectedColor = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

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

  it.each(Object.values(CatalogEntityType))(
    'colors the %s label via ENTITY_TYPE_COLOR',
    (type: CatalogEntityType) => {
      render(<EntityTypeLabel type={type} />);
      const el = screen.getByText(type);
      expect(el.style.color).toBe(toExpectedColor(ENTITY_TYPE_COLOR[type]));
    },
  );

  it('merges a custom className with the default uppercase/tracking classes', () => {
    render(
      <EntityTypeLabel type={CatalogEntityType.Agent} className="custom-cls" />,
    );

    expect(screen.getByText(CatalogEntityType.Agent).className).toContain(
      'custom-cls',
    );
  });
});
