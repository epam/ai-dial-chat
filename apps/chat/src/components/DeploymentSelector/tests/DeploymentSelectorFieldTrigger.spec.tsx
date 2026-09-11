import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeploymentSelectorFieldTrigger from '../DeploymentSelectorFieldTrigger';
import { useDeploymentSelectorFieldOverlay } from '../useDeploymentSelectorFieldOverlay';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../useDeploymentSelectorFieldOverlay');

const breakpoint = vi.hoisted(() => ({ isMobile: false }));
vi.mock('../../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: () => breakpoint.isMobile,
}));

afterEach(() => {
  breakpoint.isMobile = false;
});

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

    /* The chevron is `aria-hidden` by design (decorative, click bubbles to the
       combobox wrapper), so it has no accessible role/text a Testing Library
       query could target — this is the one way to reach that exact node. */
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
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

describe('DeploymentSelectorFieldTrigger — mobile', () => {
  it('opens the selector in a bottom sheet dialog when the field is tapped', async () => {
    breakpoint.isMobile = true;
    mockOverlay();
    const user = userEvent.setup({ delay: null });
    renderTrigger();

    await user.click(screen.getByRole('combobox'));

    expect(
      await screen.findByRole('dialog', {
        name: 'deploymentSelector.ariaLabel',
      }),
    ).toBeTruthy();
  });

  it('renders the overlay content inside the sheet, not as a loose popover', async () => {
    breakpoint.isMobile = true;
    mockOverlay();
    const user = userEvent.setup({ delay: null });
    renderTrigger();

    await user.click(screen.getByRole('combobox'));
    const sheet = await screen.findByRole('dialog', {
      name: 'deploymentSelector.ariaLabel',
    });

    expect(within(sheet).getByText('overlay content')).toBeTruthy();
    expect(screen.getAllByText('overlay content')).toHaveLength(1);
  });

  it('closes the sheet via the overlay close callback and via selection', async () => {
    breakpoint.isMobile = true;
    const onSelect = vi.fn();
    mockOverlay();
    const user = userEvent.setup({ delay: null });
    renderTrigger({ onSelect });

    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('dialog', {
      name: 'deploymentSelector.ariaLabel',
    });

    /* The mock's overlay button only calls `onClose`, closing the sheet
       without selecting. */
    await user.click(screen.getByText('overlay content'));
    expect(screen.queryByRole('dialog')).toBeNull();

    /* Selection is exercised through the wrapper the trigger passes into
       the hook — the same wrapper the real overlay's `onSelect` reaches:
       it must call `onSelect` and close the sheet. */
    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('dialog', {
      name: 'deploymentSelector.ariaLabel',
    });
    const lastHookCall = vi
      .mocked(useDeploymentSelectorFieldOverlay)
      .mock.calls.at(-1);
    act(() => lastHookCall?.[1]('gpt-4o'));

    expect(onSelect).toHaveBeenCalledWith('gpt-4o');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('exposes the sheet open state via aria-expanded and aria-haspopup=dialog', async () => {
    breakpoint.isMobile = true;
    mockOverlay();
    const user = userEvent.setup({ delay: null });
    renderTrigger();

    const trigger = screen.getByRole('combobox');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await user.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes the sheet from its close button', async () => {
    breakpoint.isMobile = true;
    mockOverlay();
    const user = userEvent.setup({ delay: null });
    renderTrigger();

    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('dialog', {
      name: 'deploymentSelector.ariaLabel',
    });

    await user.click(
      screen.getByRole('button', { name: 'deploymentSelector.closeLabel' }),
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the sheet on Escape', async () => {
    breakpoint.isMobile = true;
    mockOverlay();
    const user = userEvent.setup({ delay: null });
    renderTrigger();

    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('dialog', {
      name: 'deploymentSelector.ariaLabel',
    });

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the sheet when the field is focused and Enter is pressed', async () => {
    breakpoint.isMobile = true;
    mockOverlay();
    const user = userEvent.setup({ delay: null });
    renderTrigger();

    await user.type(screen.getByRole('combobox'), '{Enter}');

    expect(
      await screen.findByRole('dialog', {
        name: 'deploymentSelector.ariaLabel',
      }),
    ).toBeTruthy();
  });

  it('does not open the sheet when isDisabled is true', async () => {
    breakpoint.isMobile = true;
    mockOverlay();
    const user = userEvent.setup({ delay: null });
    const { container } = renderTrigger({ isDisabled: true });

    /* The disabled combobox suppresses pointer events itself, so the tap
       is aimed at the chevron region of the wrapper — the area only the
       wrapper's guard protects. Same reachable-node exception as the
       desktop chevron test above. */
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const chevron = container.querySelector('svg');
    expect(chevron).toBeTruthy();
    await user.click(chevron as SVGElement);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the catalog modal rendered outside the sheet', async () => {
    breakpoint.isMobile = true;
    mockOverlay({ catalogModal: <div>catalog modal stub</div> });
    const user = userEvent.setup({ delay: null });
    renderTrigger();

    await user.click(screen.getByRole('combobox'));
    const sheet = await screen.findByRole('dialog', {
      name: 'deploymentSelector.ariaLabel',
    });

    expect(screen.getByText('catalog modal stub')).toBeTruthy();
    expect(within(sheet).queryByText('catalog modal stub')).toBeNull();
  });
});
