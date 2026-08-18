import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PublicationRuleFunction } from '../../../models/publish';
import { PublishAccessRuleEditor } from '../PublishAccessRuleEditor';

const isDisabled = (element: Element): boolean =>
  (element as HTMLButtonElement | HTMLSelectElement | HTMLInputElement)
    .disabled === true;

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const real = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...real,
    Select: ({
      options,
      value,
      onChange,
      id,
      labelProps,
      placeholder,
      disabled,
      error,
    }: {
      options: { value: string; label: string }[];
      value?: string;
      onChange?: (v: string) => void;
      id?: string;
      labelProps?: { label?: string };
      placeholder?: string;
      disabled?: boolean;
      error?: string;
    }) => (
      <>
        <select
          id={id}
          aria-label={labelProps?.label}
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
        >
          <option value="" disabled hidden>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error && <span role="alert">{error}</span>}
      </>
    ),
    /*
     * Mirrors the real TagInput: fully controlled through `value`, committing
     * the typed text on Enter or comma. The parent's trim/dedup/cap logic is
     * exercised the same way it would be against the real component, rather
     * than firing onChange per keystroke.
     */
    TagInput: ({
      labelProps,
      placeholder,
      onChange,
      value,
      disabled,
      error,
    }: {
      labelProps?: { label?: string };
      placeholder?: string;
      onChange?: (tags: string[]) => void;
      value?: string[];
      disabled?: boolean;
      error?: string;
    }) => {
      const [text, setText] = useState('');
      const commit = () => {
        if (!text.trim()) return;
        setText('');
        onChange?.([...(value ?? []), text]);
      };
      return (
        <label>
          {labelProps?.label}
          <input
            placeholder={placeholder}
            disabled={disabled}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                commit();
              }
            }}
          />
          {error && <span role="alert">{error}</span>}
        </label>
      );
    },
  };
});

const sourceOptions = ['title', 'role', 'dial_roles'];

const renderEditor = (
  props?: Partial<Parameters<typeof PublishAccessRuleEditor>[0]>,
) => {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <PublishAccessRuleEditor
      sourceOptions={sourceOptions}
      onSave={onSave}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onSave, onCancel, ...utils };
};

describe('PublishAccessRuleEditor', () => {
  it('applies picker color overrides through the styles contract', () => {
    renderEditor({
      styles: {
        colors: {
          selectBorder: '#123456',
          selectBorderHover: '#234567',
          selectBorderFocus: '#345678',
          selectBorderOpen: '#456789',
        },
      },
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog.style.getPropertyValue('--pare-select-border')).toBe(
      '#123456',
    );
    expect(dialog.style.getPropertyValue('--pare-select-border-hover')).toBe(
      '#234567',
    );
    expect(dialog.style.getPropertyValue('--pare-select-border-focus')).toBe(
      '#345678',
    );
    expect(dialog.style.getPropertyValue('--pare-select-border-open')).toBe(
      '#456789',
    );
  });

  it('keeps Save enabled with no source selected, and shows a required-field error instead of saving', async () => {
    const { onSave } = renderEditor();
    expect(isDisabled(screen.getByRole('button', { name: 'Save' }))).toBe(
      false,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(
      screen.getAllByText('This field is required.').length,
    ).toBeGreaterThan(0);
  });

  it('keeps Save enabled with zero targets under CONTAIN, and shows a targets error instead of saving', async () => {
    const { onSave } = renderEditor();
    await userEvent.selectOptions(screen.getByLabelText('Source'), 'role');
    await userEvent.selectOptions(screen.getByLabelText('Function'), 'CONTAIN');
    expect(isDisabled(screen.getByRole('button', { name: 'Save' }))).toBe(
      false,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Add at least one target.')).toBeTruthy();
  });

  it('trims targets and saves the rule with combined OR targets', async () => {
    const { onSave } = renderEditor();
    await userEvent.selectOptions(screen.getByLabelText('Source'), 'role');
    await userEvent.selectOptions(screen.getByLabelText('Function'), 'CONTAIN');
    await userEvent.type(screen.getByLabelText('Targets'), '  engineering ,');
    await userEvent.type(screen.getByLabelText('Targets'), 'support{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({
      source: 'role',
      function: PublicationRuleFunction.Contain,
      targets: ['engineering', 'support'],
    });
  });

  it('rejects an exact-duplicate target and keeps the single tag', async () => {
    const { onSave } = renderEditor();
    await userEvent.selectOptions(screen.getByLabelText('Source'), 'role');
    await userEvent.selectOptions(screen.getByLabelText('Function'), 'CONTAIN');
    await userEvent.type(screen.getByLabelText('Targets'), 'engineering,');
    await userEvent.type(screen.getByLabelText('Targets'), 'engineering,');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({
      source: 'role',
      function: PublicationRuleFunction.Contain,
      targets: ['engineering'],
    });
  });

  it('accepts a valid regex and saves it as the single target', async () => {
    const { onSave } = renderEditor();
    await userEvent.selectOptions(
      screen.getByLabelText('Source'),
      'dial_roles',
    );
    await userEvent.selectOptions(screen.getByLabelText('Function'), 'REGEX');
    await userEvent.type(screen.getByLabelText('Pattern'), '^eng-.*$');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({
      source: 'dial_roles',
      function: PublicationRuleFunction.Regex,
      targets: ['^eng-.*$'],
    });
  });

  it('shows an inline error for an invalid regex and links the error via aria-describedby', async () => {
    renderEditor();
    await userEvent.selectOptions(
      screen.getByLabelText('Source'),
      'dial_roles',
    );
    await userEvent.selectOptions(screen.getByLabelText('Function'), 'REGEX');
    const patternInput = screen.getByLabelText('Pattern');
    await userEvent.type(patternInput, '(unclosed');

    expect(screen.getByRole('alert').textContent).toContain(
      'Enter a valid regular expression.',
    );
    const describedBy = patternInput.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(screen.getByRole('alert').id).toBe(describedBy);
  });

  it('treats an empty/whitespace-only regex as invalid and does not save', async () => {
    const { onSave } = renderEditor();
    await userEvent.selectOptions(
      screen.getByLabelText('Source'),
      'dial_roles',
    );
    await userEvent.selectOptions(screen.getByLabelText('Function'), 'REGEX');
    await userEvent.type(screen.getByLabelText('Pattern'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain(
      'Enter a valid regular expression.',
    );
  });

  it('rejects a regex pattern longer than 200 characters', async () => {
    renderEditor();
    await userEvent.selectOptions(
      screen.getByLabelText('Source'),
      'dial_roles',
    );
    await userEvent.selectOptions(screen.getByLabelText('Function'), 'REGEX');
    await userEvent.type(screen.getByLabelText('Pattern'), 'a'.repeat(201));

    expect(screen.getByRole('alert').textContent).toContain(
      'Enter a valid regular expression.',
    );
  });

  it('clears the pattern state when switching from REGEX to CONTAIN', async () => {
    renderEditor();
    await userEvent.selectOptions(
      screen.getByLabelText('Source'),
      'dial_roles',
    );
    await userEvent.selectOptions(screen.getByLabelText('Function'), 'REGEX');
    await userEvent.type(screen.getByLabelText('Pattern'), '^eng-.*$');

    await userEvent.selectOptions(screen.getByLabelText('Function'), 'CONTAIN');

    expect(screen.queryByLabelText('Pattern')).toBeNull();
    expect((screen.getByLabelText('Targets') as HTMLInputElement).value).toBe(
      '',
    );
  });

  it('disables every control when disabled is true', () => {
    renderEditor({ disabled: true });
    expect(isDisabled(screen.getByLabelText('Source'))).toBe(true);
    expect(isDisabled(screen.getByLabelText('Function'))).toBe(true);
    expect(isDisabled(screen.getByRole('button', { name: 'Save' }))).toBe(true);
    expect(isDisabled(screen.getByRole('button', { name: 'Cancel' }))).toBe(
      true,
    );
  });

  it('blocks adding a target once maxTargets is reached', async () => {
    const { onSave } = renderEditor({ maxTargets: 2 });
    await userEvent.selectOptions(screen.getByLabelText('Source'), 'role');
    await userEvent.selectOptions(screen.getByLabelText('Function'), 'CONTAIN');
    await userEvent.type(screen.getByLabelText('Targets'), 'one,');
    await userEvent.type(screen.getByLabelText('Targets'), 'two,');
    await userEvent.type(screen.getByLabelText('Targets'), 'three,');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({
      source: 'role',
      function: PublicationRuleFunction.Contain,
      targets: ['one', 'two'],
    });
  });

  it('calls onCancel via the Cancel button', async () => {
    const { onCancel } = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('cancels the in-progress rule on Escape', () => {
    const { onCancel } = renderEditor();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('Escape stops propagation so a host-level Escape listener does not also fire', () => {
    const hostKeyDownHandler = vi.fn();
    document.addEventListener('keydown', hostKeyDownHandler);
    try {
      renderEditor();
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(hostKeyDownHandler).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', hostKeyDownHandler);
    }
  });

  it('moves focus into the dialog when it opens', () => {
    renderEditor();
    expect(screen.getByRole('dialog').matches(':focus')).toBe(true);
  });
});
