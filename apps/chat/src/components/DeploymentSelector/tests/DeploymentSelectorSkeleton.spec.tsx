import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DeploymentSelectorSkeleton from '../DeploymentSelectorSkeleton';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('DeploymentSelectorSkeleton', () => {
  it('holds the popup height from the first render and announces the loading label', () => {
    const { container } = render(<DeploymentSelectorSkeleton />);

    expect(screen.getByRole('status')).toBeTruthy();
    // Decorative placeholders carry no role or text; count them structurally.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const rows = container.querySelectorAll('.flex.items-center.gap-3');
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });
});
