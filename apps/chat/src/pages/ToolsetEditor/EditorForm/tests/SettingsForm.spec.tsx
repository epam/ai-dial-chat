import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolsetEditorI18nKeys } from '../../../../constants/translation-keys';
import type {
  ToolsetAuthFormData,
  ToolsetFormData,
} from '../../../../types/toolsets';
import {
  ToolsetAuthTypes,
  ToolsetTransportType,
  WithLogin,
} from '../../../../types/toolsets';
import SettingsForm from '../SettingsForm';

vi.mock('../AuthSection', () => ({ default: () => null }));

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
  DialSelect: ({
    options,
    value,
    onChange,
    elementId,
  }: {
    options: { value: string; label: string }[];
    value?: string;
    onChange?: (v: string) => void;
    elementId?: string;
  }) => (
    <select
      id={elementId}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
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
  DialIconButton: ({
    onClick,
    'aria-label': ariaLabel,
    icon,
  }: {
    onClick?: () => void;
    'aria-label'?: string;
    icon?: React.ReactNode;
  }) => (
    <button type="button" aria-label={ariaLabel} onClick={onClick}>
      {icon}
    </button>
  ),
  ButtonAppearance: { Ghost: 'ghost' },
  ElementSize: { Standard: 'standard' },
  DIAL_ICON_SIZE: { SM: 16 },
}));

const defaultAuth: ToolsetAuthFormData = {
  authenticationType: ToolsetAuthTypes.None,
  withLogin: WithLogin.WithoutLogin,
  isLoggedIn: false,
};

const makeForm = (endpoint = ''): ToolsetFormData => ({
  name: 'My toolset',
  version: '1.0.0',
  iconUrl: '',
  description: '',
  topics: [],
  endpoint,
  protocol: ToolsetTransportType.Http,
  allowedTools: [],
  auth: defaultAuth,
});

const renderSettings = (endpoint = 'https://example.com/mcp') =>
  render(
    <SettingsForm
      form={makeForm(endpoint)}
      errors={{}}
      isSaving={false}
      toolsetId="toolsets/b/my__1.0.0"
      onChange={vi.fn()}
      onAuthChange={vi.fn()}
    />,
  );

describe('SettingsForm — copy endpoint', () => {
  const user = userEvent.setup({ delay: null });
  const mockWriteText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: mockWriteText },
    });
  });

  it('renders the copy endpoint button', () => {
    renderSettings();
    expect(
      screen.getByRole('button', {
        name: ToolsetEditorI18nKeys.CopyUrlLabel,
      }),
    ).toBeTruthy();
  });

  it('calls clipboard.writeText with the endpoint URL when copy is clicked', async () => {
    renderSettings('https://my-toolset.example.com/mcp');
    await user.click(
      screen.getByRole('button', { name: ToolsetEditorI18nKeys.CopyUrlLabel }),
    );
    expect(mockWriteText).toHaveBeenCalledWith(
      'https://my-toolset.example.com/mcp',
    );
  });

  it('does not call clipboard.writeText when endpoint is empty', async () => {
    renderSettings('');
    await user.click(
      screen.getByRole('button', { name: ToolsetEditorI18nKeys.CopyUrlLabel }),
    );
    expect(mockWriteText).not.toHaveBeenCalled();
  });

  it('renders the endpoint error message when errors.endpoint is provided', () => {
    render(
      <SettingsForm
        form={makeForm()}
        errors={{ endpoint: 'toolsetEditor.settings.endpointRequired' }}
        isSaving={false}
        toolsetId=""
        onChange={vi.fn()}
        onAuthChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain(
      ToolsetEditorI18nKeys.EndpointRequired,
    );
  });
});
