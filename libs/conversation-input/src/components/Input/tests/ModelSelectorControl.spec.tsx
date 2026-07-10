import type { DeploymentItem } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ModelSelectorControl } from '../ModelSelectorControl';

const makeDeployments = (): DeploymentItem[] => [
  { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' },
];

describe('ModelSelectorControl — mobile', () => {
  it('renders the modelPickerOverlay content inside the bottom sheet when provided', async () => {
    const user = userEvent.setup({ delay: null });
    const modelPickerOverlay = vi.fn((onClose: () => void) => (
      <button type="button" onClick={onClose}>
        overlay content
      </button>
    ));

    render(
      <ModelSelectorControl
        deployments={makeDeployments()}
        selectedDeploymentId="gpt-4o"
        onDeploymentChange={vi.fn()}
        modelSelectorLabels={{ ariaLabel: 'Select model' }}
        isStreaming={false}
        isMobile
        style={{}}
        modelPickerOverlay={modelPickerOverlay}
      />,
    );

    expect(screen.queryByText('overlay content')).toBeNull();

    await user.click(screen.getByLabelText(/Select model/));

    expect(await screen.findByText('overlay content')).toBeTruthy();
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe(
      'Select model',
    );
  });

  it('closes the sheet when the overlay calls its onClose callback', async () => {
    const user = userEvent.setup({ delay: null });
    const modelPickerOverlay = (onClose: () => void) => (
      <button type="button" onClick={onClose}>
        overlay content
      </button>
    );

    render(
      <ModelSelectorControl
        deployments={makeDeployments()}
        selectedDeploymentId="gpt-4o"
        onDeploymentChange={vi.fn()}
        modelSelectorLabels={{ ariaLabel: 'Select model' }}
        isStreaming={false}
        isMobile
        style={{}}
        modelPickerOverlay={modelPickerOverlay}
      />,
    );

    await user.click(screen.getByLabelText(/Select model/));
    await user.click(await screen.findByText('overlay content'));

    expect(screen.queryByText('overlay content')).toBeNull();
  });

  it('falls back to the flat deployment list when modelPickerOverlay is not provided', async () => {
    const user = userEvent.setup({ delay: null });

    render(
      <ModelSelectorControl
        deployments={makeDeployments()}
        selectedDeploymentId={null}
        onDeploymentChange={vi.fn()}
        modelSelectorLabels={{ ariaLabel: 'Select model' }}
        isStreaming={false}
        isMobile
        style={{}}
        modelPickerOverlay={undefined}
      />,
    );

    await user.click(screen.getByLabelText(/Select model/));

    expect((await screen.findByRole('dialog')).getAttribute('aria-label')).toBe(
      'Select model',
    );
    expect(screen.getByText('GPT-4o')).toBeTruthy();
  });
});
