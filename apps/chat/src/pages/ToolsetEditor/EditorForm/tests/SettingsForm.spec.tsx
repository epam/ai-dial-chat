import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../../../constants/translation-keys';
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

vi.mock('../../../../context/AppConfigContext', () => ({
  useAppConfig: vi.fn(() => ({
    config: { dialCoreExternalUrl: 'https://dial-core.example.com' },
  })),
}));

vi.mock('@epam/ai-dial-chat-shared', () => ({
  mergeClasses: (...classes: (string | undefined | false)[]) =>
    classes.filter(Boolean).join(' '),
  useCodeCopy: vi.fn(() => ({ isCopied: false, copy: vi.fn() })),
}));

vi.mock('../../../../utils/mcp-endpoint-url', () => ({
  buildToolsetMcpUrl: vi.fn(
    (base: string, id: string) => `${base}/v1/toolset/${id}/mcp`,
  ),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  PrimaryButton: ({
    label,
    onClick,
  }: {
    label?: string;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
  NeutralButton: ({
    label,
    onClick,
  }: {
    label?: string;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
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
    options: { value: string; label: string; description?: string }[];
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
          {o.description ? `${o.label} ${o.description}` : o.label}
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
  DialGhostIconButton: ({
    onClick,
    'aria-label': ariaLabel,
    icon,
  }: {
    onClick?: () => void;
    'aria-label'?: string;
    icon?: ReactNode;
  }) => (
    <button type="button" aria-label={ariaLabel} onClick={onClick}>
      {icon}
    </button>
  ),
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
  intro: '',
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
      onEnsureSaved={vi.fn().mockResolvedValue(true)}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SettingsForm — copy endpoint', () => {
  const user = userEvent.setup({ delay: null });
  const mockWriteText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
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
        onEnsureSaved={vi.fn().mockResolvedValue(true)}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain(
      ToolsetEditorI18nKeys.EndpointRequired,
    );
  });

  it('marks the SSE protocol option as deprecated', () => {
    renderSettings();
    const sseOption = screen.getByRole('option', {
      name: `SSE ${ToolsetEditorI18nKeys.ProtocolSseDeprecatedLabel}`,
    });
    expect(sseOption).toBeTruthy();
  });
});

describe('SettingsForm — Connect toolset section', () => {
  it('renders the connect section when dialCoreExternalUrl and toolsetId are set', () => {
    renderSettings();
    expect(screen.getByText(CatalogI18nKeys.ConnectToolsetTitle)).toBeTruthy();
    expect(
      screen.getByText(CatalogI18nKeys.ConnectToolsetDescription),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: ButtonsI18nKeys.CopyUrl }),
    ).toBeTruthy();
  });

  it('hides the connect section when toolsetId is empty', async () => {
    const { buildToolsetMcpUrl } =
      await import('../../../../utils/mcp-endpoint-url');
    render(
      <SettingsForm
        form={makeForm()}
        errors={{}}
        isSaving={false}
        toolsetId=""
        onChange={vi.fn()}
        onAuthChange={vi.fn()}
        onEnsureSaved={vi.fn().mockResolvedValue(true)}
      />,
    );
    expect(screen.queryByText(CatalogI18nKeys.ConnectToolsetTitle)).toBeNull();
    expect(buildToolsetMcpUrl).not.toHaveBeenCalled();
  });

  it('hides the connect section when dialCoreExternalUrl is absent', async () => {
    const { useAppConfig } =
      await import('../../../../context/AppConfigContext');
    const { buildToolsetMcpUrl } =
      await import('../../../../utils/mcp-endpoint-url');
    vi.mocked(useAppConfig).mockReturnValueOnce({
      config: { dialCoreExternalUrl: null },
    } as ReturnType<typeof useAppConfig>);
    render(
      <SettingsForm
        form={makeForm()}
        errors={{}}
        isSaving={false}
        toolsetId="toolsets/b/my__1.0.0"
        onChange={vi.fn()}
        onAuthChange={vi.fn()}
        onEnsureSaved={vi.fn().mockResolvedValue(true)}
      />,
    );
    expect(screen.queryByText(CatalogI18nKeys.ConnectToolsetTitle)).toBeNull();
    expect(buildToolsetMcpUrl).not.toHaveBeenCalled();
  });

  it('builds the MCP URL and passes it to the shared copy control', async () => {
    const user = userEvent.setup({ delay: null });
    const mockCopy = vi.fn();
    const { useCodeCopy } = await import('@epam/ai-dial-chat-shared');
    const { buildToolsetMcpUrl } =
      await import('../../../../utils/mcp-endpoint-url');
    vi.mocked(useCodeCopy).mockReturnValueOnce({
      isCopied: false,
      copy: mockCopy,
    });
    renderSettings();
    await user.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.CopyUrl }),
    );
    expect(buildToolsetMcpUrl).toHaveBeenCalledWith(
      'https://dial-core.example.com',
      'toolsets/b/my__1.0.0',
    );
    expect(useCodeCopy).toHaveBeenCalledWith(
      'https://dial-core.example.com/v1/toolset/toolsets/b/my__1.0.0/mcp',
    );
    expect(mockCopy).toHaveBeenCalledOnce();
  });
});
