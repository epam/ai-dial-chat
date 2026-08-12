import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DeploymentCreationFormFieldErrors,
  DeploymentCreationFormLabels,
  DeploymentCreationFormValues,
} from '../../../models/deployment-creation-form';
import { DeploymentCreationForm } from '../DeploymentCreationForm';

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-ui-kit')>()),
  Input: ({
    value,
    onChange,
    labelProps,
    error,
    placeholder,
  }: {
    value?: string;
    onChange?: (v?: string) => void;
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

vi.mock('@epam/ai-dial-kit', () => ({
  TagInput: ({
    label,
    placeholder,
    onChange,
    initialTags,
  }: {
    label?: string;
    placeholder?: string;
    onChange?: (tags: string[]) => void;
    initialTags?: string[];
  }) => (
    <label>
      {label}
      <input
        placeholder={placeholder}
        defaultValue={(initialTags ?? []).join(',')}
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
  iconUrl: { label: 'Icon URL', placeholder: 'https://...' },
  version: { label: 'Version', placeholder: 'e.g. 1.0.0' },
  topics: { label: 'Topics', placeholder: 'Add a topic' },
  otherLocales: {
    summaryLabel: 'Locales',
    editLabel: 'Edit',
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
) =>
  render(
    <DeploymentCreationForm
      values={{ ...baseValues, ...valuesOverrides }}
      errors={errors}
      onChange={onChange}
      labels={labels}
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
    expect(screen.getByLabelText('Icon URL')).toBeTruthy();
    expect(screen.getByLabelText('Version')).toBeTruthy();
    expect(screen.getByLabelText('Topics')).toBeTruthy();
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
});
