import type { DeploymentItem } from '@epam/ai-dial-chat-shared';
import {
  SKELETON_DELAY_MS,
  SKELETON_MIN_DURATION_MS,
} from '@epam/ai-dial-ui-kit';
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

  /* The shimmer adds a status region of its own beside the sheet's, so regions are read by what they announce. */
  const getStatusRegions = () => screen.getAllByRole('status');
  const getAnnouncements = () =>
    getStatusRegions().map((region) => region.textContent);

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
    const regions = getStatusRegions();
    expect(getAnnouncements()).not.toContain('Loading models');

    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS);
    });

    /* The announcing region was mounted before its text arrived. */
    const announcing = getStatusRegions().find(
      (region) => region.textContent === 'Loading models',
    );
    expect(announcing).toBeTruthy();
    expect(regions).toContain(announcing);
  });

  it('never announces a load that ends within the show delay', () => {
    vi.useFakeTimers();
    const { rerender } = renderSheet({ loadingLabel: 'Loading models' });
    const regions = getStatusRegions();

    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS / 4);
    });
    rerender(loadedSheet);
    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS + SKELETON_MIN_DURATION_MS);
    });

    const status = screen.getByRole('status');
    expect(regions).toContain(status);
    expect(status.textContent).toBe('');
    expect(screen.getByText('GPT-4o')).toBeTruthy();
  });

  it('keeps the skeleton until the minimum display time has passed, then shows the list', () => {
    vi.useFakeTimers();
    const { rerender } = renderSheet({ loadingLabel: 'Loading models' });
    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS);
    });
    const regions = getStatusRegions();
    expect(getAnnouncements()).toContain('Loading models');

    rerender(loadedSheet);
    act(() => {
      vi.advanceTimersByTime(SKELETON_MIN_DURATION_MS - 1);
    });

    expect(screen.queryByText('GPT-4o')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    const status = screen.getByRole('status');
    expect(regions).toContain(status);
    expect(status.textContent).toBe('');
    expect(screen.getByText('GPT-4o')).toBeTruthy();
  });
});
