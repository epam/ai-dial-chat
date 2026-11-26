import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  MODEL_SELECTOR_SKELETON_ROW_COUNT,
  ModelSelectorSkeletonRows,
} from './ModelSelectorSkeleton';

/* The placeholders are decorative (no role, text or test id), so the shimmer
   container is found by its busy state. */
const getBusyRegion = (): Element | null =>
  // eslint-disable-next-line testing-library/no-node-access
  document.querySelector('[aria-busy="true"]');

/* The shimmer keeps its placeholders in one wrapper, ahead of the band. */
const getPlaceholderCount = (): number =>
  // eslint-disable-next-line testing-library/no-node-access
  getBusyRegion()?.firstElementChild?.childElementCount ?? 0;

describe('ModelSelectorSkeletonRows', () => {
  it('renders seven placeholder rows in one shimmer container that announces nothing itself', () => {
    render(<ModelSelectorSkeletonRows />);

    /* The shimmer's own live region stays empty: the parent announces loading. */
    for (const status of screen.queryAllByRole('status')) {
      expect(status.textContent).toBe('');
    }
    expect(getPlaceholderCount()).toBe(MODEL_SELECTOR_SKELETON_ROW_COUNT);
  });

  it('merges the timing class onto the shimmer container', () => {
    render(<ModelSelectorSkeletonRows className="invisible" />);

    expect(getBusyRegion()?.className).toMatch(/invisible/);
  });
});
