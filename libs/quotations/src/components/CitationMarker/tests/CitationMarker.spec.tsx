import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CitationMarker } from '../CitationMarker';

const defaultLabels = {
  ariaLabel: 'Citation from Wikipedia',
  label: 'Wikipedia',
  labelWithOverflow: 'Wikipedia +2',
};

const renderMarker = (
  props: Partial<Parameters<typeof CitationMarker>[0]> = {},
) =>
  render(
    <CitationMarker
      sourceName="Wikipedia"
      annotationCount={1}
      onOpen={vi.fn()}
      labels={defaultLabels}
      {...props}
    />,
  );

describe('CitationMarker', () => {
  it('uses the single label when annotationCount is 1', () => {
    renderMarker({ annotationCount: 1 });
    expect(screen.getByText('Wikipedia')).toBeTruthy();
  });

  it('uses the overflow label when annotationCount > 1', () => {
    renderMarker({ annotationCount: 3 });
    expect(screen.getByText('Wikipedia +2')).toBeTruthy();
  });

  it('calls onOpen when clicked', async () => {
    const onOpen = vi.fn();
    renderMarker({ onOpen });
    await userEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('renders without an icon by default', () => {
    renderMarker();
    expect(screen.queryByRole('img', { name: 'link icon' })).toBeFalsy();
  });

  it('renders the provided icon before the label', () => {
    renderMarker({
      icon: <svg role="img" aria-label="link icon" />,
    });
    expect(screen.getByRole('img', { name: 'link icon' })).toBeTruthy();
  });
});
