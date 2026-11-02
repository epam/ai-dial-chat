import type { DeploymentItem } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
  it('announces the loading label through a status region', () => {
    renderSheet({ loadingLabel: 'Loading models' });

    expect(screen.getByRole('status').textContent).toBe('Loading models');
  });

  it('keeps the status region mounted and empties it once loading ends', () => {
    const { rerender } = renderSheet({ loadingLabel: 'Loading models' });
    const status = screen.getByRole('status');

    rerender(
      <ModelSelectorBottomSheet
        isOpen
        title="Select model"
        closeLabel="Close"
        onClose={vi.fn()}
        onSelect={vi.fn()}
        deployments={deployments}
      />,
    );

    expect(screen.getByRole('status')).toBe(status);
    expect(status.textContent).toBe('');
    expect(screen.getByText('GPT-4o')).toBeTruthy();
  });
});
