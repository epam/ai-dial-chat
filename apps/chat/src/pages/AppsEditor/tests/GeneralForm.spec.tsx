import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppsEditorI18nKeys } from '../../../constants/translation-keys';
import { createApplication } from '../../../server-api/applications';
import GeneralForm from '../GeneralForm';

vi.mock('../../../server-api/applications', () => ({
  createApplication: vi.fn(),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DialInput: ({
    value,
    onChange,
    labelProps,
    error,
    placeholder,
  }: {
    value?: string;
    onChange?: (v?: string) => void;
    labelProps?: { label?: string; required?: boolean };
    error?: string;
    placeholder?: string;
  }) => (
    <>
      <label>
        {labelProps?.label}
        <input
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
    </>
  ),
  DialTextarea: ({
    value,
    onChange,
    labelProps,
    placeholder,
  }: {
    value?: string;
    onChange?: (v: string) => void;
    labelProps?: { label?: string };
    placeholder?: string;
  }) => (
    <label>
      {labelProps?.label}
      <textarea
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </label>
  ),
  DialPrimaryButton: ({
    label,
    disabled,
    type,
  }: {
    label?: ReactNode;
    disabled?: boolean;
    type?: string;
  }) => (
    <button type={type === 'submit' ? 'submit' : 'button'} disabled={disabled}>
      {label}
    </button>
  ),
  DialNeutralButton: ({
    label,
    disabled,
    onClick,
    type,
  }: {
    label?: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    type?: string;
  }) => (
    <button
      type={type === 'submit' ? 'submit' : 'button'}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  ),
}));

const DEFAULT_PROPS = {
  schemaId: 'quickapps2-schema',
  onCreated: vi.fn(),
  onCancel: vi.fn(),
};

const renderForm = (props?: Partial<typeof DEFAULT_PROPS>) =>
  render(<GeneralForm {...DEFAULT_PROPS} {...props} />);

const getNameInput = () =>
  screen.getByLabelText(
    AppsEditorI18nKeys.GeneralFormNameLabel,
  ) as HTMLInputElement;

const getNextButton = () =>
  screen.getByRole('button', {
    name: AppsEditorI18nKeys.GeneralFormNextButton,
  }) as HTMLButtonElement;

const getCancelButton = () =>
  screen.getByRole('button', {
    name: AppsEditorI18nKeys.GeneralFormCancelButton,
  }) as HTMLButtonElement;

describe('GeneralForm', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders name, description and icon URL fields', () => {
    renderForm();
    expect(
      screen.getByLabelText(AppsEditorI18nKeys.GeneralFormNameLabel),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(AppsEditorI18nKeys.GeneralFormDescriptionLabel),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(AppsEditorI18nKeys.GeneralFormIconUrlLabel),
    ).toBeTruthy();
  });

  it('shows required error and does not call API when name is empty', async () => {
    renderForm();
    await user.click(getNextButton());
    expect(screen.getByRole('alert').textContent).toContain(
      AppsEditorI18nKeys.GeneralFormNameRequired,
    );
    expect(createApplication).not.toHaveBeenCalled();
  });

  it('calls createApplication and onCreated on valid submit', async () => {
    const onCreated = vi.fn();
    vi.mocked(createApplication).mockResolvedValue({
      id: 'users/u/apps/new',
    });
    renderForm({ onCreated });
    await user.type(getNameInput(), 'My App');
    await user.click(getNextButton());
    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith('users/u/apps/new'),
    );
    expect(createApplication).toHaveBeenCalledWith({
      name: 'My App',
      type: 'quickapps2-schema',
      description: undefined,
      iconUrl: undefined,
    });
  });

  it('disables Next button while submitting', async () => {
    vi.mocked(createApplication).mockReturnValue(new Promise((_resolve) => {}));
    renderForm();
    await user.type(getNameInput(), 'My App');
    await user.click(getNextButton());
    expect(getNextButton().disabled).toBe(true);
  });

  it('shows error message when API call fails', async () => {
    vi.mocked(createApplication).mockRejectedValue(new Error('network error'));
    renderForm();
    await user.type(getNameInput(), 'My App');
    await user.click(getNextButton());
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        AppsEditorI18nKeys.ErrorCreateFailed,
      ),
    );
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    renderForm({ onCancel });
    await user.click(getCancelButton());
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
