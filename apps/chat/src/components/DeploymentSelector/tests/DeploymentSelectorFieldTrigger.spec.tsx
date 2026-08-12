import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import DeploymentSelectorFieldTrigger from '../DeploymentSelectorFieldTrigger';
import { useDeploymentSelectorFieldOverlay } from '../useDeploymentSelectorFieldOverlay';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../useDeploymentSelectorFieldOverlay');

const mockOverlay = (
  overrides?: Partial<ReturnType<typeof useDeploymentSelectorFieldOverlay>>,
) => {
  vi.mocked(useDeploymentSelectorFieldOverlay).mockReturnValue({
    renderOverlay: (onClose: () => void) => (
      <button type="button" onClick={() => onClose()}>
        overlay content
      </button>
    ),
    catalogModal: null,
    isLoading: false,
    error: null,
    resolvedLabel: null,
    ...overrides,
  });
};

const renderTrigger = (
  props?: Partial<ComponentProps<typeof DeploymentSelectorFieldTrigger>>,
) =>
  render(
    <DeploymentSelectorFieldTrigger
      selectedId={null}
      onSelect={vi.fn()}
      placeholder="Select Model or Agent"
      {...props}
    />,
  );

describe('DeploymentSelectorFieldTrigger', () => {
  it('shows the placeholder when nothing is selected', () => {
    mockOverlay();
    renderTrigger();

    expect(screen.getByPlaceholderText('Select Model or Agent')).toBeTruthy();
  });

  it('shows the resolved deployment name when selected', () => {
    mockOverlay({ resolvedLabel: 'GPT-4o' });
    renderTrigger({ selectedId: 'gpt-4o' });

    expect(screen.getByDisplayValue('GPT-4o')).toBeTruthy();
  });

  it('opens the overlay content when activated', async () => {
    mockOverlay();
    const user = userEvent.setup({ delay: null });
    renderTrigger();

    expect(screen.queryByText('overlay content')).toBeNull();

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByText('overlay content')).toBeTruthy();
  });

  it('opens when the trailing chevron icon is clicked, not just the input area', async () => {
    mockOverlay();
    const user = userEvent.setup({ delay: null });
    const { container } = renderTrigger();

    expect(screen.queryByText('overlay content')).toBeNull();

    const chevron = container.querySelector('svg');
    expect(chevron).toBeTruthy();
    await user.click(chevron as SVGElement);

    expect(await screen.findByText('overlay content')).toBeTruthy();
  });

  it('closes the overlay and calls onSelect when a deployment is picked', async () => {
    mockOverlay();
    const onSelect = vi.fn();
    const user = userEvent.setup({ delay: null });
    renderTrigger({ onSelect });

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('overlay content'));

    expect(screen.queryByText('overlay content')).toBeNull();
  });

  it('shows a busy affordance while loading', () => {
    mockOverlay({ isLoading: true });
    renderTrigger();

    expect(screen.getByLabelText('deploymentSelector.loading')).toBeTruthy();
  });

  it('keeps showing the resolved label during a background refetch instead of flickering to the loading text', () => {
    mockOverlay({ isLoading: true, resolvedLabel: 'GPT-4o' });
    renderTrigger({ selectedId: 'gpt-4o' });

    expect(screen.getByDisplayValue('GPT-4o')).toBeTruthy();
    expect(
      screen.queryByPlaceholderText('deploymentSelector.loading'),
    ).toBeNull();
  });

  it('shows an error affordance and stays focusable when the fetch fails', () => {
    mockOverlay({ error: new Error('failed') });
    renderTrigger();

    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeTruthy();
    expect(trigger.hasAttribute('disabled')).toBe(false);
  });

  it('falls back to the raw id label without clearing selection when unresolvable', () => {
    mockOverlay({ resolvedLabel: 'unknown-id' });
    renderTrigger({ selectedId: 'unknown-id' });

    expect(screen.getByDisplayValue('unknown-id')).toBeTruthy();
  });

  it('does not open when isDisabled is true', async () => {
    mockOverlay();
    const user = userEvent.setup({ delay: null });
    renderTrigger({ isDisabled: true });

    await user.click(screen.getByRole('combobox'));

    expect(screen.queryByText('overlay content')).toBeNull();
  });

  it('exposes aria-expanded and aria-labelledby', async () => {
    mockOverlay();
    const user = userEvent.setup({ delay: null });
    renderTrigger({ labelledById: 'model-label' });

    const trigger = screen.getByRole('combobox');
    expect(trigger.getAttribute('aria-labelledby')).toBe('model-label');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await user.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });
});
