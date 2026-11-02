import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  MODEL_SELECTOR_SKELETON_ROW_COUNT,
  ModelSelectorSkeletonRows,
} from './ModelSelectorSkeleton';

describe('ModelSelectorSkeletonRows', () => {
  it('renders seven placeholder rows hidden from assistive tech, with no status region of its own', () => {
    const { container } = render(<ModelSelectorSkeletonRows />);

    expect(screen.queryByRole('status')).toBeNull();
    // The skeleton rows are purely decorative (aria-hidden, no role/text/testid),
    // so there is no semantic query for "how many placeholder rows rendered".
    // eslint-disable-next-line testing-library/no-node-access
    const root = container.firstElementChild;
    expect(root?.getAttribute('aria-hidden')).toBe('true');
    // eslint-disable-next-line testing-library/no-node-access
    expect(root?.children).toHaveLength(MODEL_SELECTOR_SKELETON_ROW_COUNT);
  });
});
