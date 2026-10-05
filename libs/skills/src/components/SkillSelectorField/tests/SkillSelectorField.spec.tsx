import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { SkillSelectorFieldProps } from '../../../models/skill-selector-field-props';
import { SkillSelectorField } from '../SkillSelectorField';

const skills = [
  { id: 'skills/public/report', name: 'Report' },
  { id: 'skills/public/summary', name: 'Summary' },
];

const props: SkillSelectorFieldProps = {
  value: [],
  onChange: vi.fn(),
  isSkillsSupported: true,
  skills,
  labels: {
    fieldLabel: 'Skills',
    placeholder: 'Choose a skill',
    unsupportedTooltipLabel: 'Unsupported',
    searchPlaceholder: 'Search skills',
  },
};

/* The kit shows the search input only for more than 8 options. */
const manySkills = [
  ...skills,
  ...Array.from({ length: 9 }, (_, index) => ({
    id: `skills/public/extra-${index}`,
    name: `Extra ${index}`,
  })),
];

const field = (overrides: Partial<SkillSelectorFieldProps> = {}) => (
  <SkillSelectorField {...props} {...overrides} />
);

describe('SkillSelectorField', () => {
  it('lists every skill as an option and toggles selection in RTL', async () => {
    const user = userEvent.setup();
    const Host = () => {
      const [value, onChange] = useState<string[]>([]);
      return (
        <div dir="rtl">{field({ value, onChange, skills: manySkills })}</div>
      );
    };
    render(<Host />);
    const trigger = screen.getByRole('combobox', { name: 'Skills' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.queryByRole('button', { name: 'Browse' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Summary' })).toBeTruthy();
    await user.type(
      screen.getByRole('textbox', { name: 'Search skills' }),
      'rep',
    );
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    const [report] = options;
    expect(within(report).getByRole('mark').textContent).toBe('Rep');
    report.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Remove Report' })).toBeTruthy();

    screen.getByRole('button', { name: 'Remove Report' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('button', { name: 'Remove Report' })).toBeNull();
  });

  it('shows the empty label when no skill is available', async () => {
    const user = userEvent.setup();
    render(
      field({ skills: [], labels: { ...props.labels, emptyLabel: 'None' } }),
    );
    await user.click(screen.getByRole('combobox', { name: 'Skills' }));
    expect(screen.getByText('None')).toBeTruthy();
  });

  it('retains removable unsupported references while preventing additions', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      field({
        value: ['skills/public/missing', 'skills/public/summary'],
        displayNames: { 'skills/public/summary': 'Summary' },
        onChange,
        isSkillsSupported: false,
      }),
    );
    const trigger = screen.getByRole('combobox', { name: /^Skills/ });
    expect((trigger as HTMLInputElement).disabled).toBe(false);
    await user.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    await user.click(
      screen.getByRole('button', { name: 'Remove skills/public/missing' }),
    );
    expect(onChange).toHaveBeenCalledWith(['skills/public/summary']);
  });

  it('makes every action inert while submitting', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      field({
        value: ['skills/public/report'],
        onChange,
        isDisabled: true,
      }),
    );
    const trigger = screen.getByRole('combobox', { name: /^Skills/ });
    expect((trigger as HTMLInputElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Remove Report' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('explains why an empty unsupported field is disabled', async () => {
    const user = userEvent.setup();
    render(field({ isSkillsSupported: false }));
    const trigger = screen.getByRole('combobox', { name: 'Skills' });
    expect((trigger as HTMLInputElement).disabled).toBe(true);
    expect(trigger.getAttribute('aria-describedby')).toBeTruthy();
    await user.hover(trigger);
    expect(await screen.findByRole('tooltip')).toBeTruthy();
  });

  it('associates a host validation error with the combobox', () => {
    render(field({ error: 'Choose supported skills' }));
    const trigger = screen.getByRole('combobox', { name: 'Skills' });
    expect(trigger.getAttribute('aria-describedby')).toBeTruthy();
    expect(trigger.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe(
      'Choose supported skills',
    );
  });
});
