import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeploymentSelectorSkeleton from '../DeploymentSelectorSkeleton';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/* The kit shimmer marks the loading region `aria-busy`; its placeholders carry no role or text. */
const getBusyRegion = (): Element | null =>
  // eslint-disable-next-line testing-library/no-node-access
  document.querySelector('[aria-busy="true"]');

/* The shimmer keeps its placeholders in one wrapper, ahead of the band; they carry no role or text to count by. */
const getPlaceholderCount = (): number =>
  // eslint-disable-next-line testing-library/no-node-access
  getBusyRegion()?.firstElementChild?.childElementCount ?? 0;

describe('DeploymentSelectorSkeleton', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mounts at least three rows from the first render so the popup keeps its height', () => {
    render(<DeploymentSelectorSkeleton />);

    expect(getBusyRegion()).toBeTruthy();
    expect(getPlaceholderCount()).toBeGreaterThanOrEqual(3);
  });

  it('hides the rows and announces nothing during the show delay', () => {
    vi.useFakeTimers();
    render(<DeploymentSelectorSkeleton />);

    expect(getBusyRegion()?.className).toMatch(/invisible/);
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('draws the rows and announces the loading label once the delay has passed', () => {
    vi.useFakeTimers();
    render(<DeploymentSelectorSkeleton />);
    const region = screen.getByRole('status');

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(getBusyRegion()?.className).not.toMatch(/invisible/);
    expect(screen.getByRole('status')).toBe(region);
    expect(region.textContent).toBe('deploymentSelector.loading');
  });
});
