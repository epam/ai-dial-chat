import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorI18nKeys } from '../../../../constants/translation-keys';
import type { ToolsetFormData } from '../../../../types/toolsets';
import {
  ToolsetAuthTypes,
  ToolsetTransportType,
  WithLogin,
} from '../../../../types/toolsets';
import GeneralForm from '../GeneralForm';

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
  DialTagInput: ({
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

const makeForm = (overrides?: Partial<ToolsetFormData>): ToolsetFormData => ({
  name: 'My toolset',
  version: '1.0.0',
  iconUrl: '',
  description: '',
  topics: [],
  intro: '',
  endpoint: 'https://example.com/mcp',
  protocol: ToolsetTransportType.Http,
  allowedTools: [],
  auth: {
    authenticationType: ToolsetAuthTypes.None,
    withLogin: WithLogin.WithoutLogin,
    isLoggedIn: false,
  },
  ...overrides,
});

const renderForm = (
  overrides?: Partial<ToolsetFormData>,
  errors: { name?: string; intro?: string } = {},
  onChange = vi.fn(),
) => {
  const form = makeForm(overrides);
  return render(
    <GeneralForm form={form} errors={errors} onChange={onChange} />,
  );
};

describe('GeneralForm', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders name, description, icon URL, version, topics, and intro fields', () => {
    renderForm();
    expect(screen.getByLabelText(EditorI18nKeys.NameLabel)).toBeTruthy();
    expect(screen.getByLabelText(EditorI18nKeys.DescriptionLabel)).toBeTruthy();
    expect(screen.getByLabelText(EditorI18nKeys.IconUrlLabel)).toBeTruthy();
    expect(screen.getByLabelText(EditorI18nKeys.VersionLabel)).toBeTruthy();
    expect(screen.getByLabelText(EditorI18nKeys.TopicsLabel)).toBeTruthy();
    expect(screen.getByLabelText(EditorI18nKeys.IntroLabel)).toBeTruthy();
  });

  it('displays the name error message when errors.name is provided', () => {
    renderForm(undefined, { name: EditorI18nKeys.NameRequired });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(EditorI18nKeys.NameRequired);
  });

  it('does not display an error when errors.name is absent', () => {
    renderForm();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('calls onChange with updated name when the name input changes', () => {
    const onChange = vi.fn();
    renderForm({}, {}, onChange);
    const nameInput = screen.getByLabelText(
      EditorI18nKeys.NameLabel,
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Updated' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Updated' }),
    );
  });

  it('calls onChange with updated description when the textarea changes', async () => {
    const onChange = vi.fn();
    renderForm({}, {}, onChange);
    const textarea = screen.getByLabelText(
      EditorI18nKeys.DescriptionLabel,
    ) as HTMLTextAreaElement;
    await user.type(textarea, 'A description');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.any(String) }),
    );
  });

  it('displays the intro error message when errors.intro is provided', () => {
    renderForm(undefined, { intro: EditorI18nKeys.IntroTooLong });
    expect(screen.getByText(EditorI18nKeys.IntroTooLong)).toBeTruthy();
  });

  it('calls onChange with updated intro when the intro input changes', () => {
    const onChange = vi.fn();
    renderForm({}, {}, onChange);
    const introInput = screen.getByLabelText(
      EditorI18nKeys.IntroLabel,
    ) as HTMLInputElement;
    fireEvent.change(introInput, { target: { value: 'A short pitch' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ intro: 'A short pitch' }),
    );
  });
});
