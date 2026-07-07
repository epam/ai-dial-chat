import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ButtonsI18nKeys } from '../../../constants/translation-keys';
import NegativeFeedbackModal from '../Rate/NegativeFeedbackModal';

/*
 * DialSelect uses floating-ui which can't position in jsdom — mock it as a
 * native <select> so option interaction works in tests.
 */
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const real = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...real,
    DialSelect: ({
      options,
      value,
      placeholder,
      onChange,
    }: {
      options: { value: string; label: string }[];
      value: string;
      placeholder?: string;
      onChange: (v: string) => void;
    }) => (
      <select
        value={value}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">-- select --</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    ),
  };
});

describe('NegativeFeedbackModal', () => {
  it('renders a category selector and an optional comment textarea', () => {
    render(<NegativeFeedbackModal onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('submit button is disabled when no category is selected', () => {
    render(<NegativeFeedbackModal onClose={vi.fn()} onSubmit={vi.fn()} />);
    const submitBtn = screen.getByRole('button', {
      name: ButtonsI18nKeys.Send,
    });
    expect(submitBtn.hasAttribute('disabled')).toBe(true);
  });

  it('submit button is enabled after a category is selected', async () => {
    const user = userEvent.setup();
    render(<NegativeFeedbackModal onClose={vi.fn()} onSubmit={vi.fn()} />);

    await user.selectOptions(screen.getByRole('combobox'), 'Ui bug');

    expect(
      screen
        .getByRole('button', { name: ButtonsI18nKeys.Send })
        .hasAttribute('disabled'),
    ).toBe(false);
  });

  it('calls onSubmit with formatted "category: comment" when both are provided', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<NegativeFeedbackModal onClose={vi.fn()} onSubmit={onSubmit} />);

    await user.selectOptions(
      screen.getByRole('combobox'),
      'Incomplete response',
    );
    await user.type(screen.getByRole('textbox'), 'Too short');
    await user.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Send }),
    );

    expect(onSubmit).toHaveBeenCalledWith('Incomplete response: Too short');
  });

  it('calls onSubmit with category only when comment is empty', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<NegativeFeedbackModal onClose={vi.fn()} onSubmit={onSubmit} />);

    await user.selectOptions(
      screen.getByRole('combobox'),
      'Overactive refusal',
    );
    await user.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Send }),
    );

    expect(onSubmit).toHaveBeenCalledWith('Overactive refusal');
  });
});
