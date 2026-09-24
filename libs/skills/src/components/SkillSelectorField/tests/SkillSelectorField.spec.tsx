import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SKILLS_CLASS } from '../../../constants/public-class-names';
import type { SkillSelectorFieldProps } from '../../../models/skill-selector-field-props';
import { SkillSelectorField } from '../SkillSelectorField';

const props: SkillSelectorFieldProps = {
  onChange: vi.fn(),
  isSkillsSupported: true,
  labelledById: 'skill-label',
  favorites: [
    { id: 'skills/public/report', name: 'Report' },
    { id: 'skills/public/summary', name: 'Summary' },
  ],
  labels: {
    placeholder: 'Choose a skill',
    modalTitle: 'Use skill',
    removeSkillLabel: 'Remove skill',
    unsupportedTooltipLabel: 'Unsupported',
  },
  renderCatalogContent: (onSelect, onClose) => (
    <>
      <button onClick={() => onSelect('skills/public/catalog')}>
        Pick catalog skill
      </button>
      <button onClick={onClose}>Cancel catalog</button>
    </>
  ),
};

const field = (overrides: Partial<SkillSelectorFieldProps> = {}) => (
  <>
    <span id="skill-label">Skill</span>
    <SkillSelectorField {...props} {...overrides} />
  </>
);

describe('SkillSelectorField', () => {
  it('does not steal focus when another field dismisses the dropdown', async () => {
    const user = userEvent.setup();
    render(
      <>
        {field()}
        <input aria-label="Task name" />
      </>,
    );
    await user.click(screen.getByRole('combobox', { name: 'Skill' }));
    const otherInput = screen.getByRole('textbox', { name: 'Task name' });
    await user.click(otherInput);
    expect(otherInput.matches(':focus')).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('filters favorites, selects and replaces the draft, then clears without opening the menu', async () => {
    const user = userEvent.setup();
    const Host = () => {
      const [value, onChange] = useState<string>();
      return field({ value, onChange });
    };
    render(<Host />);
    const trigger = screen.getByRole('combobox', {
      name: 'Skill',
    }) as HTMLInputElement;
    expect(
      screen.getByRole('group', { name: 'Skill' }).getAttribute('class'),
    ).toContain(SKILLS_CLASS.selectorField);
    await user.click(trigger);
    expect(
      screen.queryByRole('button', { name: 'Pick catalog skill' }),
    ).toBeNull();
    await user.type(
      screen.getByRole('textbox', { name: 'Search skills' }),
      'rep',
    );
    expect(screen.queryByRole('button', { name: 'Summary' })).toBeNull();
    const report = screen.getByRole('button', { name: 'Report' });
    expect(within(report).getByRole('mark').textContent).toBe('Rep');
    await user.click(report);
    expect(trigger.value).toBe('skills/public/report');
    await waitFor(() => expect(trigger.matches(':focus')).toBe(true));

    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Summary' }));
    expect(trigger.value).toBe('skills/public/summary');
    await user.click(screen.getByRole('button', { name: 'Remove skill' }));
    expect(trigger.value).toBe('');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove skill' })).toBeNull();
    expect(trigger.matches(':focus')).toBe(true);
  });

  it('opens the catalog only through Browse and returns focus after selection or cancellation', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(field({ onChange, favorites: [] }));
    const trigger = screen.getByRole('combobox', { name: 'Skill' });
    await user.click(trigger);
    expect(screen.getByText('Star a skill to pin it here')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Browse' }));
    await user.click(
      await screen.findByRole('button', { name: 'Pick catalog skill' }),
    );
    expect(onChange).toHaveBeenCalledWith('skills/public/catalog');
    await waitFor(() => expect(trigger.matches(':focus')).toBe(true));
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Browse' }));
    await user.click(
      await screen.findByRole('button', { name: 'Cancel catalog' }),
    );
    await waitFor(() => expect(trigger.matches(':focus')).toBe(true));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('announces no matches while keeping Browse available and closes with Escape', async () => {
    const user = userEvent.setup();
    render(field());
    const trigger = screen.getByRole('combobox', { name: 'Skill' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    await user.type(
      screen.getByRole('textbox', { name: 'Search skills' }),
      'missing',
    );
    expect(screen.getByRole('status').textContent).toBe('No matching skills');
    expect(screen.getByRole('button', { name: 'Browse' })).toBeTruthy();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger.matches(':focus')).toBe(true));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps a raw reference and removal available while unsupported, but disables all actions during submission', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      field({
        value: 'skills/public/missing',
        onChange,
        isSkillsSupported: false,
        describedById: 'skill-error',
      }),
    );
    const trigger = screen.getByRole('combobox', {
      name: 'Skill',
    }) as HTMLInputElement;
    expect(trigger.value).toBe('skills/public/missing');
    expect(trigger.disabled).toBe(true);
    expect(trigger.getAttribute('aria-invalid')).toBe('true');
    expect(trigger.getAttribute('aria-describedby')).toBe('skill-error');
    await user.click(screen.getByRole('button', { name: 'Remove skill' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
    expect(trigger.value).toBe('skills/public/missing');

    rerender(
      field({
        value: 'skills/public/other',
        displayName: 'Other skill',
        isDisabled: true,
      }),
    );
    expect(trigger.value).toBe('Other skill');
    expect(
      (
        screen.getByRole('button', {
          name: 'Remove skill',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('closes favorites and catalog on capability loss without changing the controlled selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(field({ onChange }));
    await user.click(screen.getByRole('combobox', { name: 'Skill' }));
    rerender(field({ onChange, isSkillsSupported: false }));
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(field({ onChange }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('combobox', { name: 'Skill' }));
    await user.click(screen.getByRole('button', { name: 'Browse' }));
    rerender(field({ onChange, isSkillsSupported: false }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses the same favorites and Browse actions inside a host-provided sheet', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      field({
        onChange,
        renderOverlay: (panel, open, close) =>
          open ? (
            <section role="dialog" aria-label="Mobile skills">
              {panel}
              <button onClick={close}>Close sheet</button>
            </section>
          ) : null,
      }),
    );
    const trigger = screen.getByRole('combobox', { name: 'Skill' });
    trigger.focus();
    await user.keyboard(' ');
    await user.click(
      within(screen.getByRole('dialog', { name: 'Mobile skills' })).getByRole(
        'button',
        { name: 'Report' },
      ),
    );
    expect(onChange).toHaveBeenCalledWith('skills/public/report');
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Close sheet' }));
    await waitFor(() => expect(trigger.matches(':focus')).toBe(true));
  });
});
