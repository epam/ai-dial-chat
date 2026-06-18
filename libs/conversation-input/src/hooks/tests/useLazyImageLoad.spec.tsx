import { fireEvent, render, screen } from '@testing-library/react';
import type { FC } from 'react';
import { describe, expect, it } from 'vitest';
import { LazyImageLoadStatus, useLazyImageLoad } from '../useLazyImageLoad';

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
      <span role="status">{imageLoadStatus}</span>
      {enabled && src && <img ref={imageRef} src={src} alt="Preview" />}
    </>
  );
};

describe('useLazyImageLoad', () => {
  it('starts in loading state when enabled with a source', () => {
    render(<LazyImageLoadHarness enabled src="https://example.com/a.png" />);
    expect(screen.getByRole('status').textContent).toBe(
      LazyImageLoadStatus.Loading,
    );
  });

  it('moves to loaded when the image loads', () => {
    render(<LazyImageLoadHarness enabled src="https://example.com/a.png" />);
    fireEvent.load(screen.getByAltText('Preview'));
    expect(screen.getByRole('status').textContent).toBe(
      LazyImageLoadStatus.Loaded,
    );
  });

  it('moves to error when the image fails to load', () => {
    render(<LazyImageLoadHarness enabled src="https://example.com/a.png" />);
    fireEvent.error(screen.getByAltText('Preview'));
    expect(screen.getByRole('status').textContent).toBe(
      LazyImageLoadStatus.Error,
    );
  });

  it('resets to idle when disabled', () => {
    const { rerender } = render(
      <LazyImageLoadHarness enabled src="https://example.com/a.png" />,
    );
    fireEvent.load(screen.getByAltText('Preview'));

    rerender(<LazyImageLoadHarness enabled={false} />);

    expect(screen.getByRole('status').textContent).toBe(
      LazyImageLoadStatus.Idle,
    );
  });

  it('resets to loading when the source changes', () => {
    const { rerender } = render(
      <LazyImageLoadHarness enabled src="https://example.com/a.png" />,
    );
    fireEvent.load(screen.getByAltText('Preview'));

    rerender(<LazyImageLoadHarness enabled src="https://example.com/b.png" />);

    expect(screen.getByRole('status').textContent).toBe(
      LazyImageLoadStatus.Loading,
    );
  });
});
