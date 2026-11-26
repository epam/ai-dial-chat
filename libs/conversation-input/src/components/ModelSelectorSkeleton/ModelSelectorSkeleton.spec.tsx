import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  MODEL_SELECTOR_SKELETON_ROW_COUNT,
  ModelSelectorSkeletonRows,
} from './ModelSelectorSkeleton';

describe('ModelSelectorSkeletonRows', () => {
  it('renders seven placeholder rows in one shimmer container that announces nothing itself', () => {
    const { container } = render(<ModelSelectorSkeletonRows />);

    /* The shimmer's own live region stays empty: the parent announces loading. */
    for (const status of screen.queryAllByRole('status')) {
      expect(status.textContent).toBe('');
    }
    // The placeholders are decorative (no role, text or test id), so the
    // shimmer container is found by its busy state.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const root = container.querySelector('[aria-busy="true"]');
    expect(root).not.toBeNull();
    // eslint-disable-next-line testing-library/no-node-access
    expect(root?.querySelectorAll('.flex.items-center.gap-3')).toHaveLength(
      MODEL_SELECTOR_SKELETON_ROW_COUNT,
    );
  });
});
