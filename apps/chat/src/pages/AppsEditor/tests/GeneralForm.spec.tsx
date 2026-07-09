import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppsEditorI18nKeys } from '../../../constants/translation-keys';
import { createApplication } from '../../../server-api/applications';
import type { GeneralFormHandle } from '../GeneralForm';
import GeneralForm from '../GeneralForm';

vi.mock('../../../server-api/applications', () => ({
  createApplication: vi.fn(),
}));

vi.mock('@epam/ai-dial-kit', () => ({
  Input: ({
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
  Textarea: ({
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
  TagInput: ({ label }: { label?: string }) => <span>{label}</span>,
}));

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    DialNotification: ({ message }: { variant?: string; message?: string }) => (
      <p role="alert">{message}</p>
    ),
    NotificationVariant: { Error: 'error' },
  };
});

const DEFAULT_PROPS = {
  schemaId: 'quickapps2-schema',
  onCreated: vi.fn(),
};

const renderForm = (
  props?: Partial<typeof DEFAULT_PROPS>,
  ref?: React.Ref<GeneralFormHandle>,
) => render(<GeneralForm {...DEFAULT_PROPS} {...props} ref={ref} />);

const getNameInput = () =>
  screen.getByLabelText(
    AppsEditorI18nKeys.GeneralFormNameLabel,
  ) as HTMLInputElement;

describe('GeneralForm', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders name, description, icon URL, and intro fields', () => {
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
    expect(
      screen.getByLabelText(AppsEditorI18nKeys.GeneralFormIntroLabel),
    ).toBeTruthy();
  });

  it('shows required error and does not call API when name is empty', async () => {
    const ref = createRef<GeneralFormHandle>();
    renderForm({}, ref);
    await act(async () => {
      await ref.current?.submit();
    });
    expect(screen.getByRole('alert').textContent).toContain(
      AppsEditorI18nKeys.GeneralFormNameRequired,
    );
    expect(createApplication).not.toHaveBeenCalled();
  });

  it('shows invalid error and does not call API when name contains forbidden characters', async () => {
    const ref = createRef<GeneralFormHandle>();
    renderForm({}, ref);
    await user.type(getNameInput(), 'bad/name');
    await act(async () => {
      await ref.current?.submit();
    });
    expect(screen.getByRole('alert').textContent).toContain(
      AppsEditorI18nKeys.GeneralFormNameInvalid,
    );
    expect(createApplication).not.toHaveBeenCalled();
  });

  it('shows invalid error and does not call API when version contains forbidden characters', async () => {
    const ref = createRef<GeneralFormHandle>();
    renderForm({}, ref);
    await user.type(getNameInput(), 'My App');
    await user.type(
      screen.getByLabelText(
        AppsEditorI18nKeys.GeneralFormVersionLabel,
      ) as HTMLInputElement,
      '1.0/bad',
    );
    await act(async () => {
      await ref.current?.submit();
    });
    expect(screen.getByRole('alert').textContent).toContain(
      AppsEditorI18nKeys.GeneralFormVersionInvalid,
    );
    expect(createApplication).not.toHaveBeenCalled();
  });

  it('shows length error and does not call API when intro exceeds 90 characters', async () => {
    const ref = createRef<GeneralFormHandle>();
    renderForm({}, ref);
    await user.type(getNameInput(), 'My App');
    await user.type(
      screen.getByLabelText(
        AppsEditorI18nKeys.GeneralFormIntroLabel,
      ) as HTMLInputElement,
      'a'.repeat(91),
    );
    await act(async () => {
      await ref.current?.submit();
    });
    expect(screen.getByRole('alert').textContent).toContain(
      AppsEditorI18nKeys.GeneralFormIntroTooLong,
    );
    expect(createApplication).not.toHaveBeenCalled();
  });

  it('calls createApplication and onCreated on valid submit', async () => {
    const onCreated = vi.fn();
    const ref = createRef<GeneralFormHandle>();
    vi.mocked(createApplication).mockResolvedValue({
      id: 'users/u/apps/new',
    });
    renderForm({ onCreated }, ref);
    await user.type(getNameInput(), 'My App');
    await act(async () => {
      await ref.current?.submit();
    });
    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith('users/u/apps/new'),
    );
    expect(createApplication).toHaveBeenCalledWith({
      name: 'My App',
      type: 'quickapps2-schema',
      description: undefined,
      iconUrl: undefined,
      version: undefined,
      topics: undefined,
      intro: undefined,
      applicationProperties: undefined,
    });
  });

  it('includes a trimmed intro in the create call when provided', async () => {
    const onCreated = vi.fn();
    const ref = createRef<GeneralFormHandle>();
    vi.mocked(createApplication).mockResolvedValue({
      id: 'users/u/apps/new',
    });
    renderForm({ onCreated }, ref);
    await user.type(getNameInput(), 'My App');
    await user.type(
      screen.getByLabelText(
        AppsEditorI18nKeys.GeneralFormIntroLabel,
      ) as HTMLInputElement,
      'A short pitch',
    );
    await act(async () => {
      await ref.current?.submit();
    });
    await waitFor(() => expect(createApplication).toHaveBeenCalledOnce());
    expect(createApplication).toHaveBeenCalledWith(
      expect.objectContaining({ intro: 'A short pitch' }),
    );
  });

  it('sets applicationProperties defaults for a Quick App schema', async () => {
    const ref = createRef<GeneralFormHandle>();
    vi.mocked(createApplication).mockResolvedValue({
      id: 'users/u/apps/new',
    });
    renderForm(
      { schemaId: 'https://dial/custom_application_schemas/quickapps2' },
      ref,
    );
    await user.type(getNameInput(), 'My App');
    await act(async () => {
      await ref.current?.submit();
    });
    await waitFor(() => expect(createApplication).toHaveBeenCalledOnce());
    expect(createApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationProperties: {
          orchestrator: {
            system_prompt: { type: 'custom', variables: {}, content: '' },
          },
          contexts: [],
          tool_sets: [],
        },
      }),
    );
  });

  it('shows error message when API call fails', async () => {
    const ref = createRef<GeneralFormHandle>();
    vi.mocked(createApplication).mockRejectedValue(new Error('network error'));
    renderForm({}, ref);
    await user.type(getNameInput(), 'My App');
    await act(async () => {
      await ref.current?.submit();
    });
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        AppsEditorI18nKeys.ErrorCreateFailed,
      ),
    );
  });
});
