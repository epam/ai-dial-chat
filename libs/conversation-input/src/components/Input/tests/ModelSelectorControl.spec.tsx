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
    // The kit sheet is named by its title heading, through aria-labelledby.
    expect(screen.getByRole('dialog', { name: 'Select model' })).toBeTruthy();
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

    expect(
      await screen.findByRole('dialog', { name: 'Select model' }),
    ).toBeTruthy();
    expect(screen.getByText('GPT-4o')).toBeTruthy();
  });
});

describe('ModelSelectorControl — streaming', () => {
  const renderControl = (
    overrides: Partial<{ isStreaming: boolean; isMobile: boolean }> = {},
  ) =>
    render(
      <ModelSelectorControl
        deployments={makeDeployments()}
        selectedDeploymentId="gpt-4o"
        onDeploymentChange={vi.fn()}
        modelSelectorLabels={{ ariaLabel: 'Select model' }}
        isStreaming={false}
        isMobile={false}
        style={{}}
        {...overrides}
      />,
    );

  it('opens the built-in desktop menu by keyboard when not streaming', async () => {
    const user = userEvent.setup({ delay: null });
    renderControl();

    screen.getByRole('button', { name: /Select model/ }).focus();
    await user.keyboard('{Enter}');

    expect(
      await screen.findByRole('menuitemradio', { name: /GPT-4o/ }),
    ).toBeTruthy();
  });

  it('marks the built-in desktop trigger disabled and keeps its menu closed while streaming', async () => {
    const user = userEvent.setup({ delay: null });
    renderControl({ isStreaming: true });

    const trigger = screen.getByRole('button', { name: /Select model/ });
    expect(trigger.getAttribute('aria-disabled')).toBe('true');

    trigger.focus();
    await user.keyboard('{Enter}');

    expect(screen.queryByRole('menuitemradio', { name: /GPT-4o/ })).toBeNull();
  });

  it('keeps the mobile sheet closed on keyboard activation while streaming', async () => {
    const user = userEvent.setup({ delay: null });
    renderControl({ isStreaming: true, isMobile: true });

    const trigger = screen.getByRole('button', { name: /Select model/ });
    expect(trigger.getAttribute('aria-disabled')).toBe('true');

    trigger.focus();
    await user.keyboard('{Enter}');

    expect(screen.queryByRole('dialog', { name: 'Select model' })).toBeNull();
  });
});
