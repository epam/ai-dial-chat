import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FeaturedTag } from '../FeaturedTag';

describe('FeaturedTag', () => {
  it('renders default label', () => {
    render(<FeaturedTag />);
    expect(screen.getByText('Featured')).toBeTruthy();
  });

  it('renders custom label', () => {
    render(<FeaturedTag label="New" />);
    expect(screen.getByText('New')).toBeTruthy();
  });
});
