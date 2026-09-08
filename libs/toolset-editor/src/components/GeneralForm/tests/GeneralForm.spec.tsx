import { DialFileNodeType, type DialFile } from '@epam/ai-dial-ui-kit';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DeploymentGeneralFormData,
  ToolsetFormErrors,
} from '../../../models/toolset-form';
import { GeneralForm } from '../GeneralForm';

vi.mock('@epam/ai-dial-builder-form', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@epam/ai-dial-builder-form')
  >();
  return {
    ...actual,
    AvatarPickerModal: ({
      onAttach,
    }: {
      onAttach: (result: { files: unknown[]; folderPaths: string[] }) => void;
    }) => (
      <button
        type="button"
        onClick={() =>
          onAttach({ files: [mockAvatarFile.file], folderPaths: [] })
        }
      >
        attach-avatar
      </button>
    ),
  };
});

/* Set per-test; read at click time by the AvatarPickerModal stub above. */
const mockAvatarFile = { file: undefined as unknown };

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-ui-kit')>()),
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  Input: ({
    value,
    onChange,
    onBlur,
    labelProps,
    error,
    placeholder,
  }: {
    value?: string;
    onChange?: (v?: string) => void;
    onBlur?: () => void;
    labelProps?: { label?: string };
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
          onBlur={onBlur}
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
}));

const makeForm = (
  overrides?: Partial<DeploymentGeneralFormData>,
): DeploymentGeneralFormData => ({
  name: 'My toolset',
  version: '1.0.0',
  iconUrl: '',
  description: '',
  topics: [],
  otherLocales: [],
  ...overrides,
});

const renderForm = (
  overrides?: Partial<DeploymentGeneralFormData>,
  errors: ToolsetFormErrors = {},
  onChange = vi.fn(),
) =>
  render(
    <GeneralForm
      form={makeForm(overrides)}
      errors={errors}
      bucket="bucket"
      FileManagerModal={() => null}
      resolveIconUrl={(url) => url}
      allowedMimeTypes={['image/png']}
      maxFileSizeBytes={1024}
      availableLocaleOptions={[]}
      onChange={onChange}
    />,
  );

describe('GeneralForm', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders name, description, avatar, version, and topics fields with the default labels', () => {
    renderForm();
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(screen.getByLabelText('Description')).toBeTruthy();
    expect(screen.getByText('Avatar')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add avatar' })).toBeTruthy();
    expect(screen.getByLabelText('Version')).toBeTruthy();
    expect(screen.getByLabelText('Tags')).toBeTruthy();
  });

  it('uses host-supplied labels instead of the defaults for the whole form group', () => {
    render(
      <GeneralForm
        form={makeForm()}
        errors={{}}
        bucket="bucket"
        FileManagerModal={() => null}
        resolveIconUrl={(url) => url}
        allowedMimeTypes={['image/png']}
        maxFileSizeBytes={1024}
        availableLocaleOptions={[]}
        onChange={vi.fn()}
        labels={{
          form: {
            name: { label: 'Toolset name', placeholder: 'Enter toolset name' },
            description: {
              label: 'Toolset description',
              placeholder: 'Describe the toolset',
            },
            iconUrl: {
              label: 'Icon',
              addAvatarLabel: 'Add icon',
              captionText: 'PNG only',
            },
            version: { label: 'Toolset version', placeholder: 'v1' },
            topics: { label: 'Toolset tags', placeholder: 'Tags' },
            otherLocales: {
              summaryLabel: 'Locales',
              addLabel: 'Add locales',
              editLabel: 'Edit locales',
              popupTitle: 'Add locale',
              addLocaleLabel: 'Add locale',
              localeRowLabel: 'Locale',
              languageLabel: 'Language',
              nameLabel: 'Name',
              namePlaceholder: 'Enter name',
              descriptionLabel: 'About',
              descriptionPlaceholder: 'Enter brief description',
              deleteAriaLabel: 'Delete locale',
              cancelLabel: 'Cancel',
              saveLabel: 'Save',
            },
            ariaLabel: 'General',
          },
        }}
      />,
    );
    expect(screen.getByLabelText('Toolset name')).toBeTruthy();
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add icon' })).toBeTruthy();
  });

  it('displays the name error message when errors.name is provided', () => {
    renderForm(undefined, { name: 'Name is required' });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Name is required');
  });

  it('does not display an error when errors.name is absent', () => {
    renderForm();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('calls onChange with updated name when the name input changes', () => {
    const onChange = vi.fn();
    renderForm({}, {}, onChange);
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Updated' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Updated' }),
    );
  });

  it('calls onChange with updated description when the textarea changes', async () => {
    const onChange = vi.fn();
    renderForm({}, {}, onChange);
    const textarea = screen.getByLabelText(
      'Description',
    ) as HTMLTextAreaElement;
    await user.type(textarea, 'A description');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.any(String) }),
    );
  });

  it('calls onNameBlur and onVersionBlur when the fields lose focus', async () => {
    const onNameBlur = vi.fn();
    const onVersionBlur = vi.fn();
    render(
      <GeneralForm
        form={makeForm()}
        errors={{}}
        bucket="bucket"
        FileManagerModal={() => null}
        resolveIconUrl={(url) => url}
        allowedMimeTypes={['image/png']}
        maxFileSizeBytes={1024}
        availableLocaleOptions={[]}
        onChange={vi.fn()}
        onNameBlur={onNameBlur}
        onVersionBlur={onVersionBlur}
      />,
    );
    fireEvent.blur(screen.getByLabelText('Name'));
    fireEvent.blur(screen.getByLabelText('Version'));
    expect(onNameBlur).toHaveBeenCalled();
    expect(onVersionBlur).toHaveBeenCalled();
  });

  it('reports the picked avatar through onChange after resolving it against the bucket', async () => {
    const onChange = vi.fn();
    mockAvatarFile.file = {
      nodeType: DialFileNodeType.ITEM,
      name: 'icon.png',
      contentType: 'image/png',
      url: 'https://files.example.com/icon.png',
    } as unknown as DialFile;
    render(
      <GeneralForm
        form={makeForm()}
        errors={{}}
        bucket="bucket"
        FileManagerModal={() => null}
        resolveIconUrl={(url) => url}
        allowedMimeTypes={['image/png']}
        maxFileSizeBytes={1024}
        availableLocaleOptions={[]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add avatar' }));
    await user.click(screen.getByRole('button', { name: 'attach-avatar' }));

    expect(onChange).toHaveBeenCalledWith({
      iconUrl: 'https://files.example.com/icon.png',
    });
  });

  it('leaves the icon unchanged when the picker attaches no file', async () => {
    const onChange = vi.fn();
    mockAvatarFile.file = undefined;
    render(
      <GeneralForm
        form={makeForm()}
        errors={{}}
        bucket="bucket"
        FileManagerModal={() => null}
        resolveIconUrl={(url) => url}
        allowedMimeTypes={['image/png']}
        maxFileSizeBytes={1024}
        availableLocaleOptions={[]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add avatar' }));
    await user.click(screen.getByRole('button', { name: 'attach-avatar' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
