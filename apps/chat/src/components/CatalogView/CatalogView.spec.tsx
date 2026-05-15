import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CatalogView from './CatalogView';

describe('CatalogView', () => {
  it('renders a section landmark with aria-label', () => {
    const { container } = render(<CatalogView />);
    const section = container.querySelector('section');
    expect(section).toBeTruthy();
    expect(section?.getAttribute('aria-label')).toBe('catalog.ariaLabel');
  });

  it('renders the coming soon text', () => {
    render(<CatalogView />);
    expect(screen.getByText('catalog.comingSoon')).toBeTruthy();
  });
});
