import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Ref } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DeploymentCreationFormFieldErrors,
  DeploymentCreationFormLabels,
  DeploymentCreationFormProps,
  DeploymentCreationFormValues,
} from '../../../models/deployment-creation-form';
import { MetadataField } from '../../../models/metadata-field';
import { DeploymentCreationForm } from '../DeploymentCreationForm';

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-ui-kit')>()),
  Input: ({
    value,
    onChange,
    labelProps,
    error,
    placeholder,
    inputRef,
    readOnly,
    caption,
  }: {
    value?: string;
    onChange?: (v?: string) => void;
    labelProps?: { label?: string };
    error?: string;
    placeholder?: string;
    inputRef?: Ref<HTMLInputElement>;
    readOnly?: boolean;
    caption?: string;
  }) => (
    <>
      <label>
        {labelProps?.label}
        <input
          ref={inputRef}
          value={value ?? ''}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </label>
      {caption && <p>{caption}</p>}
      {error && <p role="alert">{error}</p>}
    </>
  ),
  Textarea: ({
    value,
    onChange,
    labelProps,
    placeholder,
    error,
    ref,
  }: {
    value?: string;
    onChange?: (v: string) => void;
    labelProps?: { label?: string; required?: boolean };
    placeholder?: string;
    error?: string;
    ref?: Ref<HTMLTextAreaElement>;
  }) => (
    <>
      <label>
        {labelProps?.label}
        {labelProps?.required && ' *'}
        <textarea
          ref={ref}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
    </>
  ),
  TagInput: ({
    labelProps,
    placeholder,
    onChange,
    value,
  }: {
    labelProps?: { label?: string };
    placeholder?: string;
    onChange?: (tags: string[]) => void;
    value?: string[];
  }) => (
    <label>
      {labelProps?.label}
      <input
        placeholder={placeholder}
        value={(value ?? []).join(',')}
        onChange={(e) =>
          onChange?.(e.target.value ? e.target.value.split(',') : [])
        }
      />
    </label>
  ),
}));

const labels: DeploymentCreationFormLabels = {
  name: { label: 'Name', placeholder: 'Enter name' },
  description: { label: 'Description', placeholder: 'Describe it' },
  iconUrl: {
    label: 'Avatar',
    addAvatarLabel: 'Add avatar',
    captionText: 'PNG, JPG or SVG (max 1 MB)',
  },
  version: { label: 'Version', placeholder: 'e.g. 1.0.0' },
  topics: { label: 'Topics', placeholder: 'Add a topic' },
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
};

const baseValues: DeploymentCreationFormValues = {
  name: 'My Entity',
  description: '',
  iconUrl: '',
  version: '',
  topics: [],
  otherLocales: [],
};

const renderComponent = (
  valuesOverrides?: Partial<DeploymentCreationFormValues>,
  errors: DeploymentCreationFormFieldErrors = {},
  onChange = vi.fn(),
  onAddAvatarClick = vi.fn(),
  extraProps: Partial<DeploymentCreationFormProps> = {},
) =>
  render(
    <DeploymentCreationForm
      values={{ ...baseValues, ...valuesOverrides }}
      errors={errors}
      onChange={onChange}
      onAddAvatarClick={onAddAvatarClick}
      labels={labels}
      {...extraProps}
    />,
  );

describe('DeploymentCreationForm', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all shared fields', () => {
    renderComponent();
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(screen.getByLabelText('Description')).toBeTruthy();
    expect(screen.getByText('Avatar')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add avatar' })).toBeTruthy();
    expect(screen.getByText('PNG, JPG or SVG (max 1 MB)')).toBeTruthy();
    expect(screen.getByLabelText('Version')).toBeTruthy();
    expect(screen.getByLabelText('Topics')).toBeTruthy();
  });

  it('calls onAddAvatarClick when the Add avatar button is clicked', async () => {
    const onAddAvatarClick = vi.fn();
    renderComponent(undefined, {}, vi.fn(), onAddAvatarClick);
    await user.click(screen.getByRole('button', { name: 'Add avatar' }));
    expect(onAddAvatarClick).toHaveBeenCalledOnce();
  });

  it('calls onChange with a name patch when the name input changes', () => {
    const onChange = vi.fn();
    renderComponent(undefined, {}, onChange);
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Updated' },
    });
    expect(onChange).toHaveBeenCalledWith({ name: 'Updated' });
  });

  it('calls onChange with a description patch when the textarea changes', async () => {
    const onChange = vi.fn();
    renderComponent(undefined, {}, onChange);
    await user.type(screen.getByLabelText('Description'), 'x');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.any(String) }),
    );
  });

  it('surfaces a passed-in name error without validating itself', () => {
    renderComponent(undefined, { name: 'Name is required' });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Name is required');
  });

  it('renders no error when none is passed', () => {
    renderComponent();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders only the requested fields, with Name alone on its row', () => {
    renderComponent(undefined, {}, vi.fn(), vi.fn(), {
      fields: [MetadataField.Name, MetadataField.Description],
      availableLocaleOptions: [{ code: 'de', label: 'DE' }],
    });
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(screen.getByLabelText('Description')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add avatar' })).toBeNull();
    expect(screen.queryByLabelText('Version')).toBeNull();
    expect(screen.queryByLabelText('Topics')).toBeNull();
    expect(screen.queryByText('Add locales')).toBeNull();
  });

  it('marks Description required, renders a name caption and a read-only Name', () => {
    renderComponent(undefined, {}, vi.fn(), vi.fn(), {
      isDescriptionRequired: true,
      isNameReadOnly: true,
      nameCaption: 'Lowercase letters and hyphens',
    });
    expect(screen.getByText('Lowercase letters and hyphens')).toBeTruthy();
    expect((screen.getByLabelText('Name') as HTMLInputElement).readOnly).toBe(
      true,
    );
    expect(screen.getByLabelText('Description *')).toBeTruthy();
  });

  it('surfaces a description error', () => {
    renderComponent(undefined, { description: 'Description is required' });
    expect(screen.getByRole('alert').textContent).toBe(
      'Description is required',
    );
  });

  it('moves focus to Description when it is the only field that becomes invalid', () => {
    const { rerender } = renderComponent();
    rerender(
      <DeploymentCreationForm
        values={baseValues}
        errors={{ description: 'Description is required' }}
        onChange={vi.fn()}
        onAddAvatarClick={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.getByLabelText('Description').matches(':focus')).toBe(true);
  });

  it('moves focus to Name first when Name and Description become invalid together', () => {
    const { rerender } = renderComponent();
    rerender(
      <DeploymentCreationForm
        values={baseValues}
        errors={{ name: 'Name is required', description: 'Required' }}
        onChange={vi.fn()}
        onAddAvatarClick={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.getByLabelText('Name').matches(':focus')).toBe(true);
  });

  it('falls back to the default tags placeholder when the host omits one', () => {
    renderComponent(undefined, {}, vi.fn(), vi.fn(), {
      labels: { ...labels, topics: { label: 'Tags' } },
    });
    expect(
      screen.getByPlaceholderText('Add tags, comma separated'),
    ).toBeTruthy();
  });

  it('does not move focus when an error appears while the focus request key is unchanged', () => {
    const { rerender } = renderComponent(undefined, {}, vi.fn(), vi.fn(), {
      focusRequestKey: 0,
    });
    rerender(
      <DeploymentCreationForm
        values={baseValues}
        errors={{ name: 'Name is required' }}
        onChange={vi.fn()}
        onAddAvatarClick={vi.fn()}
        labels={labels}
        focusRequestKey={0}
      />,
    );
    expect(screen.getByLabelText('Name').matches(':focus')).toBe(false);
  });

  it('moves focus to the first invalid field each time the focus request key changes', () => {
    const { rerender } = renderComponent(undefined, {}, vi.fn(), vi.fn(), {
      focusRequestKey: 0,
    });
    rerender(
      <DeploymentCreationForm
        values={baseValues}
        errors={{ version: 'Invalid version' }}
        onChange={vi.fn()}
        onAddAvatarClick={vi.fn()}
        labels={labels}
        focusRequestKey={1}
      />,
    );
    expect(screen.getByLabelText('Version').matches(':focus')).toBe(true);
  });
});
