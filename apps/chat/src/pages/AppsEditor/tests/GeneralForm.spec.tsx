import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, Ref } from 'react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppsEditorI18nKeys,
  EditorI18nKeys,
} from '../../../constants/translation-keys';
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
    ErrorMessageNotification: ({
      message,
    }: {
      variant?: string;
      message?: string;
    }) => <p role="alert">{message}</p>,
    NotificationVariant: { Error: 'error' },
  };
});

vi.mock('@epam/ai-dial-catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-catalog')>();
  return {
    ...actual,
    Card: () => <div>Preview</div>,
  };
});

type GeneralFormProps = Omit<ComponentProps<typeof GeneralForm>, 'ref'>;

const DEFAULT_PROPS: Pick<GeneralFormProps, 'schemaId' | 'onCreated'> = {
  schemaId: 'quickapps2-schema',
  onCreated: vi.fn(),
};

const renderForm = (
  props?: Partial<GeneralFormProps>,
  ref?: Ref<GeneralFormHandle>,
) => render(<GeneralForm {...DEFAULT_PROPS} {...props} ref={ref} />);

const getNameInput = () =>
  screen.getByLabelText(`${EditorI18nKeys.NameLabel} [EN]`) as HTMLInputElement;

describe('GeneralForm', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders name, description, and icon URL fields', () => {
    renderForm();
    expect(
      screen.getByLabelText(`${EditorI18nKeys.NameLabel} [EN]`),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(`${EditorI18nKeys.DescriptionLabel} [EN]`),
    ).toBeTruthy();
    expect(screen.getByLabelText(EditorI18nKeys.IconUrlLabel)).toBeTruthy();
  });

  it('shows required error and does not call API when name is empty', async () => {
    const ref = createRef<GeneralFormHandle>();
    renderForm({}, ref);
    await act(async () => {
      await ref.current?.submit();
    });
    expect(screen.getByRole('alert').textContent).toContain(
      EditorI18nKeys.NameRequired,
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
      screen.getByLabelText(EditorI18nKeys.VersionLabel) as HTMLInputElement,
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
      expect(onCreated).toHaveBeenCalledWith(
        'users/u/apps/new',
        'My App',
        undefined,
      ),
    );
    expect(createApplication).toHaveBeenCalledWith({
      name: 'My App',
      type: 'quickapps2-schema',
      description: undefined,
      iconUrl: undefined,
      version: undefined,
      topics: undefined,
      applicationProperties: undefined,
    });
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

  it('normalizes undefined initial values and calls onCreated on Next without persisting for an existing app', async () => {
    const onCreated = vi.fn();
    const ref = createRef<GeneralFormHandle>();

    renderForm(
      {
        appId: 'users/u/apps/existing',
        onCreated,
        initialValues: {
          name: ' My App ',
          description: undefined,
          iconUrl: undefined,
          version: undefined,
          topics: undefined,
        },
      },
      ref,
    );

    await act(async () => {
      await ref.current?.submit();
    });

    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith(
        'users/u/apps/existing',
        'My App',
        undefined,
      ),
    );
    expect(createApplication).not.toHaveBeenCalled();
  });

  it('advances to the next step without persisting edited General fields for an existing app', async () => {
    const onCreated = vi.fn();
    const ref = createRef<GeneralFormHandle>();

    renderForm(
      {
        appId: 'users/u/apps/existing',
        onCreated,
        initialValues: { name: 'My App' },
      },
      ref,
    );

    await user.clear(getNameInput());
    await user.type(getNameInput(), 'Renamed App');
    await user.type(
      screen.getByLabelText(`${EditorI18nKeys.DescriptionLabel} [EN]`),
      'New description',
    );

    await act(async () => {
      await ref.current?.submit();
    });

    expect(onCreated).toHaveBeenCalledWith(
      'users/u/apps/existing',
      'Renamed App',
      undefined,
    );
    expect(createApplication).not.toHaveBeenCalled();
  });

  describe('getValues', () => {
    it('returns the seeded initial values normalized, with no version field', () => {
      const ref = createRef<GeneralFormHandle>();

      renderForm(
        {
          appId: 'users/u/apps/existing',
          initialValues: { name: 'My App', topics: ['a', 'b'] },
        },
        ref,
      );

      expect(ref.current?.getValues()).toEqual({
        name: 'My App',
        description: undefined,
        iconUrl: undefined,
        topics: ['a', 'b'],
      });
    });

    it('returns the current trimmed values after edits, including display_version but excluding the backend version field', async () => {
      const ref = createRef<GeneralFormHandle>();

      renderForm(
        {
          appId: 'users/u/apps/existing',
          initialValues: { name: 'My App', version: '1.0.0' },
        },
        ref,
      );

      await user.clear(getNameInput());
      await user.type(getNameInput(), '  Renamed App  ');
      await user.type(
        screen.getByLabelText(`${EditorI18nKeys.DescriptionLabel} [EN]`),
        'New description',
      );

      expect(ref.current?.getValues()).toEqual({
        name: 'Renamed App',
        description: 'New description',
        display_version: '1.0.0',
        iconUrl: undefined,
        topics: undefined,
      });
    });
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
