import { fireEvent, render, screen } from '@testing-library/react';
import type { FC } from 'react';
import { describe, expect, it } from 'vitest';
import { useLazyImageLoad } from '../useLazyImageLoad';

interface LazyImageLoadHarnessProps {
  enabled: boolean;
  src?: string;
}

const LazyImageLoadHarness: FC<LazyImageLoadHarnessProps> = ({
  enabled,
  src,
}) => {
  const { imageRef, imageLoadStatus } = useLazyImageLoad({ enabled, src });

  return (
    <>
      <span data-testid="status">{imageLoadStatus}</span>
      {enabled && src && <img ref={imageRef} src={src} alt="Preview" />}
    </>
  );
};

describe('useLazyImageLoad', () => {
  it('starts in loading state when enabled with a source', () => {
    render(<LazyImageLoadHarness enabled src="https://example.com/a.png" />);
    expect(screen.getByTestId('status').textContent).toBe('loading');
  });

  it('moves to loaded when the image loads', () => {
    render(<LazyImageLoadHarness enabled src="https://example.com/a.png" />);
    fireEvent.load(screen.getByAltText('Preview'));
    expect(screen.getByTestId('status').textContent).toBe('loaded');
  });

  it('moves to error when the image fails to load', () => {
    render(<LazyImageLoadHarness enabled src="https://example.com/a.png" />);
    fireEvent.error(screen.getByAltText('Preview'));
    expect(screen.getByTestId('status').textContent).toBe('error');
  });

  it('resets to idle when disabled', () => {
    const { rerender } = render(
      <LazyImageLoadHarness enabled src="https://example.com/a.png" />,
    );
    fireEvent.load(screen.getByAltText('Preview'));

    rerender(<LazyImageLoadHarness enabled={false} />);

    expect(screen.getByTestId('status').textContent).toBe('idle');
  });

  it('resets to loading when the source changes', () => {
    const { rerender } = render(
      <LazyImageLoadHarness enabled src="https://example.com/a.png" />,
    );
    fireEvent.load(screen.getByAltText('Preview'));

    rerender(<LazyImageLoadHarness enabled src="https://example.com/b.png" />);

    expect(screen.getByTestId('status').textContent).toBe('loading');
  });
});
