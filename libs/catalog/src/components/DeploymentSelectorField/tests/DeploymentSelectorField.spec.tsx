import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DeploymentSelectorField } from '../DeploymentSelectorField';

const renderField = (
  props: Partial<ComponentProps<typeof DeploymentSelectorField>> = {},
) =>
  render(
    <>
      <span id="model-label">Model</span>
      <DeploymentSelectorField
        selectedId={null}
        records={[{ id: 'model', label: 'Model A' }]}
        placeholder="Choose"
        labelledById="model-label"
        labels={{
          searchPlaceholder: 'Search',
          searchAriaLabel: 'Search models',
          emptyLabel: 'Nothing here',
          errorLabel: 'Error',
          browseLabel: 'Browse',
        }}
        onSelect={vi.fn()}
        {...props}
      />
    </>,
  );

describe('DeploymentSelectorField', () => {
  it('selects a resolved record and preserves an unavailable selected id', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderField({ selectedId: 'removed', onSelect });
    const trigger = screen.getByRole<HTMLInputElement>('combobox');
    expect(trigger.value).toBe('removed');
    expect(screen.queryByRole('option')).toBeNull();
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'Model A' }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('model');
    expect(screen.queryByRole('option')).toBeNull();
    await waitFor(() => expect(trigger.matches(':focus')).toBe(true));
  });

  it('keeps Browse available when records are empty', async () => {
    const onBrowse = vi.fn();
    const user = userEvent.setup();
    renderField({ records: [], onBrowse });
    await user.click(screen.getByRole('combobox'));
    expect(await screen.findByText('Nothing here')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Browse' }));
    expect(onBrowse).toHaveBeenCalledOnce();
    expect(screen.queryByText('Nothing here')).toBeNull();
  });

  it('opens from the keyboard and returns focus after selection', async () => {
    const user = userEvent.setup();
    renderField();
    await user.tab();
    const trigger = screen.getByRole('combobox');
    await user.keyboard('{Enter}');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await user.click(await screen.findByRole('option', { name: 'Model A' }));
    await waitFor(() => expect(trigger.matches(':focus')).toBe(true));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders record icons and descriptions in searchable options', async () => {
    const user = userEvent.setup();
    renderField({
      records: [
        {
          id: 'model',
          label: 'Model A',
          description: 'For longer tasks',
          icon: <span>Model icon</span>,
        },
      ],
    });
    await user.click(screen.getByRole('combobox'));
    const option = await screen.findByRole('option', {
      name: 'Model A For longer tasks',
    });
    expect(within(option).getByText('Model icon')).toBeTruthy();
    expect(within(option).getByText('For longer tasks')).toBeTruthy();
  });

  it.each([false, true])(
    'uses the custom panel with a custom overlay=%s',
    async (customOverlay) => {
      const user = userEvent.setup();
      renderField({
        renderPanel: (close) => <button onClick={close}>Host panel</button>,
        ariaHasPopup: customOverlay ? 'dialog' : 'listbox',
        renderOverlay: customOverlay
          ? (panel, open) =>
              open && (
                <div role="dialog" aria-label="Choose model">
                  {panel}
                </div>
              )
          : undefined,
      });
      const trigger = screen.getByRole('combobox');
      await user.click(trigger);
      expect(
        await screen.findByRole('button', { name: 'Host panel' }),
      ).toBeTruthy();
      expect(screen.queryByRole('option')).toBeNull();
      if (customOverlay) {
        expect(
          within(screen.getByRole('dialog')).getByText('Host panel'),
        ).toBeTruthy();
        expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
      }
      await user.click(screen.getByRole('button', { name: 'Host panel' }));
      expect(screen.queryByText('Host panel')).toBeNull();
      await waitFor(() => expect(trigger.matches(':focus')).toBe(true));
    },
  );

  it('does not open a disabled custom overlay from the trailing affordance', async () => {
    const user = userEvent.setup();
    renderField({
      isDisabled: true,
      iconAfter: <span>Open picker</span>,
      renderOverlay: (panel, open) => open && <div role="dialog">{panel}</div>,
    });
    await user.click(screen.getByText('Open picker'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
