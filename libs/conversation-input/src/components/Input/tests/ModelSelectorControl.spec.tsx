import type { DeploymentItem } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('ModelSelectorControl — desktop modelPickerOverlay', () => {
  it('renders the host overlay in a named dialog rather than a menu', async () => {
    const user = userEvent.setup({ delay: null });

    render(
      <ModelSelectorControl
        deployments={makeDeployments()}
        selectedDeploymentId="gpt-4o"
        onDeploymentChange={vi.fn()}
        modelSelectorLabels={{ ariaLabel: 'Select model' }}
        isStreaming={false}
        isMobile={false}
        style={{}}
        modelPickerOverlay={() => <input aria-label="Search models" />}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Select model/ });
    await user.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Select model' });
    expect(dialog.contains(screen.getByLabelText('Search models'))).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
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

describe('ModelSelectorControl — unavailable deployment', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderUnavailable = (
    props: Partial<Parameters<typeof ModelSelectorControl>[0]> = {},
  ) =>
    render(
      <ModelSelectorControl
        deployments={makeDeployments()}
        selectedDeploymentId="removed-model"
        onDeploymentChange={vi.fn()}
        modelSelectorLabels={{
          ariaLabel: 'Select model',
          unavailableTooltip: 'Deployment is gone',
        }}
        isStreaming={false}
        isMobile={false}
        style={{}}
        {...props}
      />,
    );

  it.each([
    { presentation: 'desktop menu', props: {} },
    {
      presentation: 'desktop host overlay',
      props: { modelPickerOverlay: () => <div>overlay content</div> },
    },
    { presentation: 'mobile sheet', props: { isMobile: true } },
  ])(
    'shows the unavailable tooltip when the $presentation trigger is hovered',
    async ({ props }) => {
      const user = userEvent.setup({ delay: null });
      renderUnavailable(props);

      await user.hover(screen.getByRole('button', { name: /Select model/ }));

      expect(await screen.findByText('Deployment is gone')).toBeTruthy();
    },
  );

  it('falls back to the English unavailable tooltip without a label', async () => {
    const user = userEvent.setup({ delay: null });
    renderUnavailable({ modelSelectorLabels: { ariaLabel: 'Select model' } });

    await user.hover(screen.getByRole('button', { name: /Select model/ }));

    expect(
      await screen.findByText('This deployment is no longer available'),
    ).toBeTruthy();
  });

  it('shows the deployment name, not the unavailable tooltip, for an available deployment', async () => {
    const user = userEvent.setup({ delay: null });
    renderUnavailable({ selectedDeploymentId: 'gpt-4o' });

    await user.hover(screen.getByRole('button', { name: /Select model/ }));

    expect(await screen.findByRole('tooltip')).toBeTruthy();
    expect(screen.queryByText('Deployment is gone')).toBeNull();
  });
});
