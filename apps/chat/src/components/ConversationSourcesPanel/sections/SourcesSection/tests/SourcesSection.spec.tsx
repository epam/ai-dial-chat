import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SourcesSection from '../SourcesSection';

describe('SourcesSection', () => {
  it('renders the title', () => {
    render(<SourcesSection title="Sources" />);
    expect(screen.getByText('Sources')).toBeTruthy();
  });

  it('does not render an empty placeholder', () => {
    render(<SourcesSection title="Sources" />);
    expect(screen.queryByText('No sources available.')).toBeNull();
  });
});
