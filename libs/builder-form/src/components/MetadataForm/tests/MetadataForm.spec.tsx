import type { AttachResult } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Ref } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeploymentCreationFormValues } from '../../../models/deployment-creation-form';
import { MetadataField } from '../../../models/metadata-field';
import type {
  MetadataFormAvatarPicker,
  MetadataFormProps,
} from '../../../models/metadata-form-props';
import { MetadataForm } from '../MetadataForm';

/* Set per-test; read at click time by the AvatarPickerModal stub below. */
const mockAttachResult = {
  value: { files: [], folderPaths: [] } as unknown as AttachResult,
};

vi.mock('../../AvatarPickerModal/AvatarPickerModal', () => ({
  AvatarPickerModal: ({
    isOpen,
    onAttach,
  }: {
    isOpen: boolean;
    onAttach: (result: AttachResult) => void;
  }) =>
    isOpen ? (
      <button type="button" onClick={() => onAttach(mockAttachResult.value)}>
        attach-avatar
      </button>
    ) : null,
}));

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-ui-kit')>()),
  Input: ({
    value,
    onChange,
    onBlur,
    labelProps,
    error,
    placeholder,
    inputRef,
  }: {
    value?: string;
    onChange?: (v?: string) => void;
    onBlur?: () => void;
    labelProps?: { label?: string };
    error?: string;
    placeholder?: string;
    inputRef?: Ref<HTMLInputElement>;
  }) => (
    <>
      <label>
        {labelProps?.label}
        <input
          ref={inputRef}
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

const values: DeploymentCreationFormValues = {
  name: 'My entity',
  version: '1.0.0',
  iconUrl: '',
  description: '',
  topics: [],
  otherLocales: [],
};

const localeOptions = [{ code: 'de', label: 'DE' }];

const makeAvatarPicker = (
  overrides?: Partial<MetadataFormAvatarPicker>,
): MetadataFormAvatarPicker => ({
  bucket: 'bucket',
  FileManagerModal: () => null,
  resolveIconUrl: (url) => url,
  resolveAttachedIconUrl: () => undefined,
  allowedMimeTypes: ['image/png'],
  maxFileSizeBytes: 1024,
  ...overrides,
});

const renderForm = (props: Partial<MetadataFormProps> = {}) =>
  render(
    <MetadataForm
      values={values}
      errors={{}}
      onChange={vi.fn()}
      avatarPicker={makeAvatarPicker()}
      {...props}
    />,
  );

describe('MetadataForm', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders every metadata field with the English default labels', () => {
    renderForm({ availableLocaleOptions: localeOptions });
    expect(screen.getByRole('button', { name: 'Add avatar' })).toBeTruthy();
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(screen.getByLabelText('Version')).toBeTruthy();
    expect(screen.getByLabelText('Description')).toBeTruthy();
    expect(screen.getByText('Add locales')).toBeTruthy();
    expect(screen.getByLabelText('Tags')).toBeTruthy();
    expect(
      screen.getByPlaceholderText('Add tags, comma separated'),
    ).toBeTruthy();
  });

  it('renders only Name and Description for a prompt-style editor without avatar wiring', () => {
    renderForm({
      fields: [MetadataField.Name, MetadataField.Description],
      avatarPicker: undefined,
      availableLocaleOptions: localeOptions,
    });
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(screen.getByLabelText('Description')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add avatar' })).toBeNull();
    expect(screen.queryByLabelText('Version')).toBeNull();
    expect(screen.queryByLabelText('Tags')).toBeNull();
    expect(screen.queryByText('Add locales')).toBeNull();
  });

  it('hides the avatar field when the host supplies no avatar picker', () => {
    renderForm({ avatarPicker: undefined });
    expect(screen.queryByRole('button', { name: 'Add avatar' })).toBeNull();
    expect(screen.getByLabelText('Name')).toBeTruthy();
  });

  it('uses host-supplied form labels instead of the defaults', () => {
    renderForm({
      labels: {
        form: {
          name: { label: 'Toolset name' },
          description: { label: 'About' },
          iconUrl: {
            label: 'Icon',
            addAvatarLabel: 'Add icon',
            captionText: 'PNG only',
          },
          version: { label: 'Toolset version' },
          topics: { label: 'Toolset tags' },
          otherLocales: {
            summaryLabel: 'Locales',
            addLabel: 'Add locales',
            editLabel: 'Edit locales',
            popupTitle: 'Add locale',
            addLocaleLabel: 'Add locale',
            languageLabel: 'Language',
            nameLabel: 'Name',
            descriptionLabel: 'About',
            deleteAriaLabel: 'Delete locale',
          },
        },
      },
    });
    expect(screen.getByLabelText('Toolset name')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add icon' })).toBeTruthy();
  });

  it('shows the name error supplied by the host', () => {
    renderForm({ errors: { name: 'Name is required' } });
    expect(screen.getByRole('alert').textContent).toBe('Name is required');
  });

  it('reports field edits and blur events to the host', () => {
    const onChange = vi.fn();
    const onNameBlur = vi.fn();
    const onVersionBlur = vi.fn();
    renderForm({ onChange, onNameBlur, onVersionBlur });

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Renamed' },
    });
    fireEvent.blur(screen.getByLabelText('Name'));
    fireEvent.blur(screen.getByLabelText('Version'));

    expect(onChange).toHaveBeenCalledWith({ name: 'Renamed' });
    expect(onNameBlur).toHaveBeenCalled();
    expect(onVersionBlur).toHaveBeenCalled();
  });

  it('stores the icon URL the host resolves for a picked file and closes the picker', async () => {
    const onChange = vi.fn();
    const resolveAttachedIconUrl = vi.fn(() => 'files/bucket/icon.png');
    renderForm({
      onChange,
      avatarPicker: makeAvatarPicker({ resolveAttachedIconUrl }),
    });

    await user.click(screen.getByRole('button', { name: 'Add avatar' }));
    await user.click(screen.getByRole('button', { name: 'attach-avatar' }));

    expect(resolveAttachedIconUrl).toHaveBeenCalledWith(mockAttachResult.value);
    expect(onChange).toHaveBeenCalledWith({
      iconUrl: 'files/bucket/icon.png',
    });
    expect(screen.queryByRole('button', { name: 'attach-avatar' })).toBeNull();
  });

  it('leaves the icon unchanged when the host resolves no URL for the picked file', async () => {
    const onChange = vi.fn();
    renderForm({ onChange });

    await user.click(screen.getByRole('button', { name: 'Add avatar' }));
    await user.click(screen.getByRole('button', { name: 'attach-avatar' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
