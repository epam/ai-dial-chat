import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CatalogI18nKeys } from '../../constants/translation-keys';
import CatalogView from './CatalogView';

describe('CatalogView', () => {
  it('renders a section landmark with aria-label', () => {
    const { container } = render(<CatalogView />);
    const section = container.querySelector('section');
    expect(section).toBeTruthy();
    expect(section?.getAttribute('aria-label')).toBe(CatalogI18nKeys.AriaLabel);
  });

  it('renders the coming soon text', () => {
    render(<CatalogView />);
    expect(screen.getByText(CatalogI18nKeys.ComingSoon)).toBeTruthy();
  });
});
