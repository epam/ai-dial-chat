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
    }: {
      options: { value: string; label: string }[];
      value?: string;
      onChange?: (v: string) => void;
      id?: string;
      labelProps?: { label?: string };
      placeholder?: string;
      disabled?: boolean;
    }) => (
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
    ),
    // Mirrors real DialTagInput's "commit on Enter or comma" behavior so
    // parent-driven dedup/remount logic is exercised the same way it would
    // be against the real component, rather than firing onChange per keystroke.
    DialTagInput: ({
      label,
      placeholder,
      onChange,
      initialTags,
      disabled,
    }: {
      label?: string;
      placeholder?: string;
      onChange?: (tags: string[]) => void;
      initialTags?: string[];
      disabled?: boolean;
    }) => {
      const [tags, setTags] = useState<string[]>(initialTags ?? []);
      const [text, setText] = useState('');
      const commit = () => {
        if (!text.trim()) return;
        const next = [...tags, text];
        setTags(next);
        setText('');
        onChange?.(next);
      };
      return (
        <label>
          {label}
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
  it('disables Save with no source selected', () => {
    renderEditor();
    expect(isDisabled(screen.getByRole('button', { name: 'Save' }))).toBe(true);
  });

  it('disables Save with zero targets under CONTAIN', async () => {
    renderEditor();
    await userEvent.selectOptions(screen.getByLabelText('Source'), 'role');
    await userEvent.selectOptions(screen.getByLabelText('Function'), 'CONTAIN');
    expect(isDisabled(screen.getByRole('button', { name: 'Save' }))).toBe(true);
  });

  it('trims targets and saves the rule with combined OR targets', async () => {
    const { onSave } = renderEditor();
    await userEvent.selectOptions(screen.getByLabelText('Source'), 'role');
    await userEvent.selectOptions(screen.getByLabelText('Function'), 'CONTAIN');
    // Re-query after each commit: trimming a tag with surrounding whitespace
    // remounts the tag input to sync its displayed value to the trimmed form.
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
    // Re-query the input after each commit: a rejected duplicate remounts it.
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

  it('shows an inline error for an invalid regex, disables Save, and links the error via aria-describedby', async () => {
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
    expect(isDisabled(screen.getByRole('button', { name: 'Save' }))).toBe(true);
    const describedBy = patternInput.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toBe(
      screen.getByRole('alert'),
    );
  });

  it('treats an empty/whitespace-only regex as invalid', async () => {
    renderEditor();
    await userEvent.selectOptions(
      screen.getByLabelText('Source'),
      'dial_roles',
    );
    await userEvent.selectOptions(screen.getByLabelText('Function'), 'REGEX');
    await userEvent.type(screen.getByLabelText('Pattern'), '   ');

    expect(isDisabled(screen.getByRole('button', { name: 'Save' }))).toBe(true);
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
    expect(isDisabled(screen.getByRole('button', { name: 'Save' }))).toBe(true);
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
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });
});
