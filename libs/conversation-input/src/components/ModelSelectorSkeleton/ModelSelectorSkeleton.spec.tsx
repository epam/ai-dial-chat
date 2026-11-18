/*
 * The skeleton is decorative: aria-hidden bars with no role, name or text, so
 * counting them, checking a class or reading an inline custom property has no
 * semantic Testing Library query. Each test still anchors on the rendered root.
 */
/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import { SELECT_LIST_MAX_HEIGHT_CLASS_NAME } from '@epam/ai-dial-chat-shared';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  MODEL_SELECTOR_SKELETON_ROW_COUNT,
  ModelSelectorPanelSkeleton,
  ModelSelectorSkeletonRows,
} from './ModelSelectorSkeleton';

describe('ModelSelectorSkeletonRows', () => {
  it('renders seven placeholder rows hidden from assistive tech, with no status region of its own', () => {
    const { container } = render(<ModelSelectorSkeletonRows />);

    expect(screen.queryByRole('status')).toBeNull();
    const root = container.firstElementChild;
    expect(root?.getAttribute('aria-hidden')).toBe('true');
    expect(root?.children).toHaveLength(MODEL_SELECTOR_SKELETON_ROW_COUNT);
  });
});

describe('ModelSelectorPanelSkeleton', () => {
  it('announces the loading label through a status region that is mounted empty first', async () => {
    const { container } = render(
      <ModelSelectorPanelSkeleton loadingLabel="Loading models…" />,
    );

    const region = screen.getByRole('status');
    await waitFor(() => expect(region.textContent).toBe('Loading models…'));
    expect(screen.getByRole('status')).toBe(region);
    expect(container.textContent).toBe('Loading models…');
  });

  it('keeps the status region empty when no loading label is given', () => {
    render(<ModelSelectorPanelSkeleton />);

    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('hides every placeholder bar from assistive tech', () => {
    const { container } = render(<ModelSelectorPanelSkeleton />);
    const visibleBlocks = Array.from(
      container.firstElementChild?.children ?? [],
    )
      .filter((child) => child.getAttribute('role') !== 'status')
      .filter((child) => child.getAttribute('aria-hidden') !== 'true');
    expect(visibleBlocks).toHaveLength(0);
  });

  it('caps the options box at the same height as the loaded list', () => {
    const { container } = render(<ModelSelectorPanelSkeleton />);
    const optionsBoxes = container.getElementsByClassName(
      SELECT_LIST_MAX_HEIGHT_CLASS_NAME,
    );
    expect(optionsBoxes).toHaveLength(1);
    expect(optionsBoxes[0]?.getAttribute('aria-hidden')).toBe('true');
  });

  it('forwards the skeleton colour override as a custom property on the root', () => {
    const { container } = render(
      <ModelSelectorPanelSkeleton skeletonColor="#123456" />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--ci-skeleton-color')).toBe('#123456');
  });
});
