import { ToolsetAuthTypes, WithLogin } from '@epam/ai-dial-chat-hooks';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolsetTransportType } from '../../../constants/toolsets';
import type {
  ToolsetAuthActions,
  ToolsetAuthFormData,
  ToolsetFormData,
} from '../../../models/toolset-form';
import type { SettingsFormProps } from '../../../models/settings-form-props';
import { SettingsForm } from '../SettingsForm';

vi.mock('../../AuthSection/AuthSection', () => ({
  AuthSection: () => null,
}));

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
  useCodeCopy: vi.fn(() => ({ isCopied: false, copy: vi.fn() })),
  CopyButton: ({
    copyLabel,
    copiedLabel,
    isCopied,
    onClick,
  }: {
    copyLabel?: string;
    copiedLabel?: string;
    isCopied?: boolean;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {isCopied ? copiedLabel : copyLabel}
    </button>
  ),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  Input: ({
    value,
    onChange,
    labelProps,
    error,
    placeholder,
    caption,
  }: {
    value?: string;
    onChange?: (v?: string) => void;
    labelProps?: { label?: string; required?: boolean };
    error?: string;
    placeholder?: string;
    caption?: string;
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
      {caption && <p>{caption}</p>}
      {error && <p role="alert">{error}</p>}
    </>
  ),
  RadioGroup: ({
    items,
    value,
    onChange,
    labelProps,
    id,
  }: {
    items: { value: string; label: string }[];
    value?: string;
    onChange?: (v: string) => void;
    labelProps?: { label?: string };
    id?: string;
  }) => (
    <fieldset>
      <legend>{labelProps?.label}</legend>
      {items.map((item) => (
        <label key={item.value}>
          <input
            type="radio"
            name={id}
            value={item.value}
            checked={value === item.value}
            onChange={() => onChange?.(item.value)}
          />
          {item.label}
        </label>
      ))}
    </fieldset>
  ),
  Select: ({
    labelProps,
    placeholder,
    options,
  }: {
    labelProps?: { label?: string };
    placeholder?: string;
    options: { value: string; label: string }[];
  }) => (
    <div>
      <span>{labelProps?.label}</span>
      <span>{placeholder}</span>
      <ul>
        {options.map((option) => (
          <li key={option.value}>{option.label}</li>
        ))}
      </ul>
    </div>
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

const authActions: ToolsetAuthActions = {
  login: vi.fn(),
  logout: vi.fn(),
  fetchAuthSettings: vi.fn(),
};

const defaultAuth: ToolsetAuthFormData = {
  authenticationType: ToolsetAuthTypes.None,
  withLogin: WithLogin.WithoutLogin,
  isLoggedIn: false,
};

const makeForm = (overrides?: Partial<ToolsetFormData>): ToolsetFormData => ({
  name: 'My toolset',
  version: '1.0.0',
  iconUrl: '',
  description: '',
  topics: [],
  otherLocales: [],
  endpoint: 'https://example.com/mcp',
  protocol: ToolsetTransportType.Http,
  allowedTools: [],
  auth: defaultAuth,
  ...overrides,
});

const renderSettings = (props: Partial<SettingsFormProps> = {}) =>
  render(
    <SettingsForm
      form={makeForm()}
      errors={{}}
      isSaving={false}
      toolsetId="toolsets/b/my__1.0.0"
      isEditMode
      authActions={authActions}
      oauthCallbackPath="/auth/toolset-signin"
      onNotifySuccess={vi.fn()}
      onNotifyError={vi.fn()}
      onChange={vi.fn()}
      onAuthChange={vi.fn()}
      onEnsureSaved={vi.fn().mockResolvedValue(true)}
      {...props}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SettingsForm — endpoint field', () => {
  it('renders the endpoint error message when errors.endpoint is provided', () => {
    renderSettings({ errors: { endpoint: 'Endpoint is required' } });
    expect(screen.getByRole('alert').textContent).toContain(
      'Endpoint is required',
    );
  });

  it('renders HTTP and SSE as protocol radio options', () => {
    renderSettings();
    expect(screen.getByRole('radio', { name: 'HTTP' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'SSE' })).toBeTruthy();
  });

  it('reports protocol changes through onChange', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    renderSettings({ onChange });

    await user.click(screen.getByRole('radio', { name: 'SSE' }));

    expect(onChange).toHaveBeenCalledWith({ protocol: ToolsetTransportType.Sse });
  });
});

describe('SettingsForm — allowed tools field', () => {
  it('renders the free-text tag input when listToolNames is omitted', () => {
    renderSettings();
    expect(
      screen.getByPlaceholderText('Add tools, comma separated'),
    ).toBeTruthy();
  });

  it('renders the select with fetched tool names once they resolve', async () => {
    const listToolNames = vi.fn().mockResolvedValue(['echo', 'fetch']);
    renderSettings({ listToolNames });

    expect(await screen.findByText('echo')).toBeTruthy();
    expect(screen.getByText('fetch')).toBeTruthy();
    expect(listToolNames).toHaveBeenCalledWith('toolsets/b/my__1.0.0');
    expect(
      screen.queryByPlaceholderText('Add tools, comma separated'),
    ).toBeNull();
  });

  it('falls back to the tag input when the fetch resolves no tools', async () => {
    const listToolNames = vi.fn().mockResolvedValue([]);
    renderSettings({ listToolNames });

    await waitFor(() =>
      expect(
        screen.getByPlaceholderText('Add tools, comma separated'),
      ).toBeTruthy(),
    );
    expect(
      screen.queryByText('Select allowed tools'),
    ).toBeNull();
  });

  it('falls back to the tag input when the fetch rejects', async () => {
    const listToolNames = vi.fn().mockRejectedValue(new Error('fail'));
    renderSettings({ listToolNames });

    await waitFor(() =>
      expect(
        screen.getByPlaceholderText('Add tools, comma separated'),
      ).toBeTruthy(),
    );
  });

  it('does not fetch tool names before the toolset is persisted', () => {
    const listToolNames = vi.fn().mockResolvedValue(['echo']);
    renderSettings({ toolsetId: '', isEditMode: false, listToolNames });

    expect(listToolNames).not.toHaveBeenCalled();
    expect(
      screen.getByPlaceholderText('Add tools, comma separated'),
    ).toBeTruthy();
  });
});

describe('SettingsForm — Connect toolset section', () => {
  it('renders the connect section when connectUrl and toolsetId are set', () => {
    renderSettings({ connectUrl: 'https://dial-core.example.com/mcp' });
    expect(screen.getByText('Connect toolset')).toBeTruthy();
    expect(
      screen.getByText(
        'Copy endpoint URL to easily integrate toolset into your workflows',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Copy URL' }),
    ).toBeTruthy();
  });

  it('hides the connect section when toolsetId is empty', () => {
    renderSettings({
      toolsetId: '',
      isEditMode: false,
      connectUrl: 'https://dial-core.example.com/mcp',
    });
    expect(screen.queryByText('Connect toolset')).toBeNull();
  });

  it('hides the connect section when connectUrl is omitted', () => {
    renderSettings();
    expect(screen.queryByText('Connect toolset')).toBeNull();
  });

  it('passes the host-resolved URL to the shared copy control', async () => {
    const user = userEvent.setup({ delay: null });
    const mockCopy = vi.fn();
    const { useCodeCopy } = await import('@epam/ai-dial-chat-shared');
    vi.mocked(useCodeCopy).mockReturnValueOnce({
      isCopied: false,
      copy: mockCopy,
    });
    renderSettings({ connectUrl: 'https://dial-core.example.com/mcp' });

    await user.click(screen.getByRole('button', { name: 'Copy URL' }));

    expect(useCodeCopy).toHaveBeenCalledWith(
      'https://dial-core.example.com/mcp',
    );
    expect(mockCopy).toHaveBeenCalledOnce();
  });

  it('threads the connect labels through to the section', () => {
    renderSettings({
      connectUrl: 'https://dial-core.example.com/mcp',
      labels: {
        connect: {
          title: 'Connect toolset title',
          description: 'Connect toolset description',
          copyLabel: 'Copy the URL',
          copiedLabel: 'Copied the URL!',
        },
      },
    });
    expect(screen.getByText('Connect toolset title')).toBeTruthy();
    expect(screen.getByText('Connect toolset description')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Copy the URL' }),
    ).toBeTruthy();
  });
});
