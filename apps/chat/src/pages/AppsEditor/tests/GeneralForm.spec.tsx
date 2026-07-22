import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, Ref } from 'react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppsEditorI18nKeys,
  EditorI18nKeys,
} from '../../../constants/translation-keys';
import {
  createApplication,
  updateApplication,
} from '../../../server-api/applications';
import type { GeneralFormHandle } from '../GeneralForm';
import GeneralForm from '../GeneralForm';

vi.mock('../../../server-api/applications', () => ({
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
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
  screen.getByLabelText(EditorI18nKeys.NameLabel) as HTMLInputElement;

describe('GeneralForm', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders name, description, icon URL, and intro fields', () => {
    renderForm();
    expect(screen.getByLabelText(EditorI18nKeys.NameLabel)).toBeTruthy();
    expect(screen.getByLabelText(EditorI18nKeys.DescriptionLabel)).toBeTruthy();
    expect(screen.getByLabelText(EditorI18nKeys.IconUrlLabel)).toBeTruthy();
    expect(screen.getByLabelText(EditorI18nKeys.IntroLabel)).toBeTruthy();
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

  it('shows length error and does not call API when intro exceeds 90 characters', async () => {
    const ref = createRef<GeneralFormHandle>();
    renderForm({}, ref);
    await user.type(getNameInput(), 'My App');
    await user.type(
      screen.getByLabelText(EditorI18nKeys.IntroLabel) as HTMLInputElement,
      'a'.repeat(91),
    );
    await act(async () => {
      await ref.current?.submit();
    });
    expect(screen.getByRole('alert').textContent).toContain(
      EditorI18nKeys.IntroTooLong,
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
      screen.getByLabelText(EditorI18nKeys.IntroLabel) as HTMLInputElement,
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
    expect(updateApplication).not.toHaveBeenCalled();
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
      screen.getByLabelText(EditorI18nKeys.DescriptionLabel),
      'New description',
    );
    await user.type(
      screen.getByLabelText(EditorI18nKeys.IntroLabel) as HTMLInputElement,
      'New intro',
    );

    await act(async () => {
      await ref.current?.submit();
    });

    expect(updateApplication).not.toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalledWith(
      'users/u/apps/existing',
      'Renamed App',
      undefined,
    );
    expect(createApplication).not.toHaveBeenCalled();
  });

  describe('persist', () => {
    it('does not call updateApplication when no field changed from the seeded initial values', async () => {
      const ref = createRef<GeneralFormHandle>();

      renderForm(
        {
          appId: 'users/u/apps/existing',
          initialValues: { name: 'My App', topics: ['a', 'b'] },
        },
        ref,
      );

      await act(async () => {
        await ref.current?.persist();
      });

      expect(updateApplication).not.toHaveBeenCalled();
    });

    it('calls updateApplication with the current values when a field changed from the seeded initial values', async () => {
      const ref = createRef<GeneralFormHandle>();
      vi.mocked(updateApplication).mockResolvedValue({
        id: 'users/u/apps/existing',
      });

      renderForm(
        {
          appId: 'users/u/apps/existing',
          initialValues: { name: 'My App' },
        },
        ref,
      );

      await user.clear(getNameInput());
      await user.type(getNameInput(), 'Renamed App');
      await user.type(
        screen.getByLabelText(EditorI18nKeys.DescriptionLabel),
        'New description',
      );
      await user.type(
        screen.getByLabelText(EditorI18nKeys.IntroLabel) as HTMLInputElement,
        'New intro',
      );

      await act(async () => {
        await ref.current?.persist();
      });

      expect(updateApplication).toHaveBeenCalledWith('users/u/apps/existing', {
        name: 'Renamed App',
        description: 'New description',
        iconUrl: undefined,
        topics: undefined,
        intro: 'New intro',
      });
    });

    it('rejects and does not swallow the error when updateApplication fails', async () => {
      const ref = createRef<GeneralFormHandle>();
      vi.mocked(updateApplication).mockRejectedValue(
        new Error('network error'),
      );

      renderForm(
        {
          appId: 'users/u/apps/existing',
          initialValues: { name: 'My App' },
        },
        ref,
      );

      await user.clear(getNameInput());
      await user.type(getNameInput(), 'Renamed App');

      await expect(
        act(async () => {
          await ref.current?.persist();
        }),
      ).rejects.toThrow('network error');
      expect(screen.queryByRole('alert')).toBeNull();
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
