import type { DeploymentItem } from '@epam/ai-dial-chat-shared';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ModelSelectorBottomSheet,
  type ModelSelectorBottomSheetProps,
} from '../ModelSelectorBottomSheet';

const deployments: DeploymentItem[] = [
  { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' },
];

const renderSheet = (props?: Partial<ModelSelectorBottomSheetProps>) =>
  render(
    <ModelSelectorBottomSheet
      isOpen
      title="Select model"
      closeLabel="Close"
      onClose={vi.fn()}
      onSelect={vi.fn()}
      {...props}
    />,
  );

describe('ModelSelectorBottomSheet — loading', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /* The sheet's own region comes first in the DOM; the shimmer adds an unused one after it. */
  const getStatusRegion = () => screen.getAllByRole('status')[0];

  const loadedSheet = (
    <ModelSelectorBottomSheet
      isOpen
      title="Select model"
      closeLabel="Close"
      onClose={vi.fn()}
      onSelect={vi.fn()}
      deployments={deployments}
    />
  );

  it('announces nothing during the show delay and the loading label once the skeleton is drawn', () => {
    vi.useFakeTimers();
    renderSheet({ loadingLabel: 'Loading models' });
    const status = getStatusRegion();
    expect(status.textContent).toBe('');

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(getStatusRegion()).toBe(status);
    expect(status.textContent).toBe('Loading models');
  });

  it('never announces a load that ends within the show delay', () => {
    vi.useFakeTimers();
    const { rerender } = renderSheet({ loadingLabel: 'Loading models' });
    const status = getStatusRegion();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender(loadedSheet);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(getStatusRegion()).toBe(status);
    expect(status.textContent).toBe('');
    expect(screen.getByText('GPT-4o')).toBeTruthy();
  });

  it('keeps the skeleton until the minimum display time has passed, then shows the list', () => {
    vi.useFakeTimers();
    const { rerender } = renderSheet({ loadingLabel: 'Loading models' });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    const status = getStatusRegion();
    expect(status.textContent).toBe('Loading models');

    rerender(loadedSheet);
    act(() => {
      vi.advanceTimersByTime(499);
    });

    expect(screen.queryByText('GPT-4o')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(getStatusRegion()).toBe(status);
    expect(status.textContent).toBe('');
    expect(screen.getByText('GPT-4o')).toBeTruthy();
  });
});
