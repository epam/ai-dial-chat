import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  MODEL_SELECTOR_SKELETON_ROW_COUNT,
  ModelSelectorSkeletonRows,
} from './ModelSelectorSkeleton';

describe('ModelSelectorSkeletonRows', () => {
  it('renders seven hidden placeholder rows with an accessible loading label', () => {
    render(<ModelSelectorSkeletonRows loadingLabel="Loading models" />);

    const status = screen.getByRole('status', { name: 'Loading models' });
    // The skeleton rows are purely decorative (aria-hidden, no role/text/testid),
    // so there is no semantic query for "how many placeholder rows rendered".
    // eslint-disable-next-line testing-library/no-node-access
    expect(status.querySelectorAll('[aria-hidden="true"]')).toHaveLength(
      MODEL_SELECTOR_SKELETON_ROW_COUNT,
    );
  });
});
