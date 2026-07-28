import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReportIssueDialog from '../ReportIssueDialog';

const { mockSubmit } = vi.hoisted(() => ({
  mockSubmit: vi.fn(),
}));

vi.mock('../../../hooks/useReportIssue/useReportIssue', () => ({
  useReportIssue: () => ({ isLoading: false, submit: mockSubmit }),
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
  PopupSize: { Sm: 'sm' },
}));

vi.mock('@epam/ai-dial-kit', () => ({
  Input: ({ id, value, placeholder, onChange }) => (
    <input
      id={id}
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
  render(<ReportIssueDialog isOpen onClose={onClose} />);

const fillAllFields = () => {
  fireEvent.change(
    screen.getByLabelText('footer.reportIssue.issueTitleLabel'),
    { target: { value: 'Bug title' } },
  );
  fireEvent.change(
    screen.getByLabelText('footer.reportIssue.descriptionLabel'),
    { target: { value: 'Detailed description' } },
  );
};

describe('ReportIssueDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmit.mockResolvedValue(false);
  });

  it('renders null when isOpen is false', () => {
    render(<ReportIssueDialog isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows required errors on both fields when submitted empty', async () => {
    renderDialog();

    await userEvent.click(screen.getByText('buttons.send'));

    expect(
      screen.getAllByText('footer.reportIssue.fieldRequired'),
    ).toHaveLength(2);
  });

  it('stays open when submit returns false (server error)', async () => {
    mockSubmit.mockResolvedValue(false);
    const onClose = vi.fn();
    render(<ReportIssueDialog isOpen onClose={onClose} />);

    fillAllFields();

    await userEvent.click(screen.getByText('buttons.send'));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledOnce();
      expect(onClose).not.toHaveBeenCalled();
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('calls submit hook and closes dialog when all fields are valid', async () => {
    const onClose = vi.fn();
    mockSubmit.mockResolvedValue(true);
    render(<ReportIssueDialog isOpen onClose={onClose} />);

    fillAllFields();

    await userEvent.click(screen.getByText('buttons.send'));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledOnce();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
