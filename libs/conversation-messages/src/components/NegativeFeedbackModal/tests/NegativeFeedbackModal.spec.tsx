import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { NegativeFeedbackModalProps } from '../../../models/negative-feedback-modal';
import { NegativeFeedbackCategory } from '../../../types/negative-feedback-category';
import { NegativeFeedbackModal } from '../NegativeFeedbackModal';

/* Native stand-in for the kit Select, so options can be picked by value. */
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const real = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...real,
    Select: ({
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

const renderModal = (props?: Partial<NegativeFeedbackModalProps>) =>
  render(
    <NegativeFeedbackModal onClose={vi.fn()} onSubmit={vi.fn()} {...props} />,
  );

describe('NegativeFeedbackModal', () => {
  it('renders a category selector and an optional comment textarea', () => {
    renderModal();

    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('keeps the send button disabled until a category is selected', async () => {
    const user = userEvent.setup();
    renderModal();
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send.hasAttribute('disabled')).toBe(true);

    await user.selectOptions(screen.getByRole('combobox'), 'UI bug');

    expect(send.hasAttribute('disabled')).toBe(false);
  });

  it('submits "category: comment" when a comment is typed', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderModal({ onSubmit });

    await user.selectOptions(
      screen.getByRole('combobox'),
      NegativeFeedbackCategory.IncompleteResponse,
    );
    await user.type(screen.getByRole('textbox'), '  Too short  ');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(onSubmit).toHaveBeenCalledWith('Incomplete response: Too short');
  });

  it('submits only the category when the comment is empty', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderModal({ onSubmit });

    await user.selectOptions(
      screen.getByRole('combobox'),
      NegativeFeedbackCategory.OveractiveRefusal,
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(onSubmit).toHaveBeenCalledWith('Overactive refusal');
  });

  it('offers every category in enum order with its exact value', () => {
    renderModal();

    expect(
      screen
        .getAllByRole('option')
        .slice(1)
        .map((option) => (option as HTMLOptionElement).value),
    ).toEqual(Object.values(NegativeFeedbackCategory));
  });

  it('hides the comment textarea when isCommentEnabled is false', () => {
    renderModal({ isCommentEnabled: false });

    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('shows host labels and keeps the category value on submit', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderModal({
      onSubmit,
      labels: {
        sendLabel: 'Envoyer',
        categoryLabels: { [NegativeFeedbackCategory.UiBug]: 'Bogue UI' },
      },
    });

    expect(screen.getByRole('option', { name: 'Bogue UI' })).toBeTruthy();
    await user.selectOptions(screen.getByRole('combobox'), 'Bogue UI');
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(onSubmit).toHaveBeenCalledWith('UI bug');
  });

  it('calls onClose when the popup is dismissed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onClose });

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
  });
});
