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

    const status = screen
      .getAllByRole('status')
      .find((element) => element.textContent === 'Loading models');
    expect(status).toBeTruthy();
  });

  it('keeps the status region mounted and empties it once loading ends', () => {
    const { rerender } = renderSheet({ loadingLabel: 'Loading models' });
    const status = screen
      .getAllByRole('status')
      .find((element) => element.textContent === 'Loading models');
    expect(status).toBeTruthy();

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

    expect(screen.getAllByRole('status')).toContain(status);
    expect(status?.textContent).toBe('');
    expect(screen.getByText('GPT-4o')).toBeTruthy();
  });
});
