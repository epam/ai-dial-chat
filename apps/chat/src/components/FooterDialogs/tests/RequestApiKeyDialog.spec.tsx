import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RequestApiKeyDialog from '../RequestApiKeyDialog';

const { mockSubmit } = vi.hoisted(() => ({
  mockSubmit: vi.fn(),
}));

vi.mock('../../../hooks/useRequestApiKey/useRequestApiKey', () => ({
  useRequestApiKey: () => ({ isLoading: false, submit: mockSubmit }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DialFormPopup: ({ open, header, children, onClose, onSubmit, submitLabel, cancelLabel, isLoading }) =>
    !open ? null : (
      <div role="dialog" aria-label={header}>
        {children}
        <button type="button" onClick={onClose}>{cancelLabel}</button>
        <button type="button" onClick={onSubmit} disabled={isLoading ?? false}>
          {submitLabel}
        </button>
      </div>
    ),
  DialFormItem: ({ id, label, error, children }) => (
    <div>
      <label htmlFor={id}>{label}</label>
      {children}
      {error && <span role="alert">{error}</span>}
    </div>
  ),
  DialCheckbox: ({ id, label, checked, onChange }) => (
    <label>
      <input
        type="checkbox"
        id={id}
        checked={checked ?? false}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      {label}
    </label>
  ),
  DialErrorText: ({ text }: { text?: string }) =>
    text ? <span role="alert">{text}</span> : null,
  PopupSize: { Md: 'md', Sm: 'sm' },
}));

vi.mock('@epam/ai-dial-kit', () => ({
  Input: ({ id, value, placeholder, onChange, type }) => (
    <input
      id={id}
      type={type ?? 'text'}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
  Textarea: ({ id, value, placeholder, onChange }) => (
    <textarea
      id={id}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

const renderDialog = (onClose = vi.fn()) =>
  render(<RequestApiKeyDialog isOpen onClose={onClose} />);

const fillAllFields = () => {
  fireEvent.change(
    screen.getByLabelText('footer.requestApiKey.projectNameLabel'),
    { target: { value: 'My Project' } },
  );
  fireEvent.change(
    screen.getByLabelText('footer.requestApiKey.streamNameLabel'),
    { target: { value: 'My Stream' } },
  );
  fireEvent.change(
    screen.getByLabelText('footer.requestApiKey.projectLeadLabel'),
    { target: { value: 'lead@example.com' } },
  );
  fireEvent.change(
    screen.getByLabelText('footer.requestApiKey.businessReasonLabel'),
    { target: { value: 'Business justification' } },
  );
  fireEvent.change(
    screen.getByLabelText('footer.requestApiKey.projectEndLabel'),
    { target: { value: '2025-12-31' } },
  );
  fireEvent.change(
    screen.getByLabelText('footer.requestApiKey.accessScenarioLabel'),
    { target: { value: 'Internal use only' } },
  );
  fireEvent.change(
    screen.getByLabelText('footer.requestApiKey.workloadPatternLabel'),
    { target: { value: 'Batch processing' } },
  );
  screen
    .getAllByRole('checkbox')
    .forEach((cb) => fireEvent.change(cb, { target: { checked: true } }));
};

describe('RequestApiKeyDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmit.mockResolvedValue(false);
  });

  it('renders null when isOpen is false', () => {
    render(<RequestApiKeyDialog isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows required errors on all fields when submitted empty', async () => {
    renderDialog();

    await userEvent.click(screen.getByText('buttons.send'));

    expect(
      screen.getAllByText('footer.requestApiKey.fieldRequired'),
    ).toHaveLength(7);
    expect(
      screen.getByText('footer.requestApiKey.checkboxGroupRequired'),
    ).toBeTruthy();
  });

  it('shows an email validation error when project lead email is invalid', async () => {
    renderDialog();

    fillAllFields();
    fireEvent.change(
      screen.getByLabelText('footer.requestApiKey.projectLeadLabel'),
      { target: { value: 'notanemail' } },
    );

    await userEvent.click(screen.getByText('buttons.send'));

    expect(screen.getByText('footer.requestApiKey.emailInvalid')).toBeTruthy();
  });

  it('calls submit hook and closes dialog when all fields are valid', async () => {
    const onClose = vi.fn();
    mockSubmit.mockResolvedValue(true);
    render(<RequestApiKeyDialog isOpen onClose={onClose} />);

    fillAllFields();

    await userEvent.click(screen.getByText('buttons.send'));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledOnce();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
