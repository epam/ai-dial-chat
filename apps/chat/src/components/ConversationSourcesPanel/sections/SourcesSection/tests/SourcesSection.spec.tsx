import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SourcesSection from '../SourcesSection';

describe('SourcesSection', () => {
  it('renders the title', () => {
    render(<SourcesSection title="Sources" emptyMessage="No sources." />);
    expect(screen.getByText('Sources')).toBeTruthy();
  });

  it('always renders the empty placeholder (links not yet supported)', () => {
    render(
      <SourcesSection title="Sources" emptyMessage="No sources available." />,
    );
    expect(screen.getByText('No sources available.')).toBeTruthy();
  });
});
