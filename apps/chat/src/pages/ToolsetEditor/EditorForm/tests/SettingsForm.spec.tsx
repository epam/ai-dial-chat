import { ToolsetAuthTypes, WithLogin } from '@epam/ai-dial-chat-hooks';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolsetTransportType } from '../../../../constants/toolsets';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../../../constants/translation-keys';
import type {
  ToolsetAuthFormData,
  ToolsetFormData,
} from '../../../../models/toolsets';
import SettingsForm from '../SettingsForm';
vi.mock('../AuthSection', () => ({ default: () => null }));

vi.mock('../../../../context/AppConfigContext', () => ({
  useAppConfig: vi.fn(() => ({
    config: { dialCoreExternalUrl: 'https://dial-core.example.com' },
  })),
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

vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>();
  return {
    ...actual,
    buildToolsetMcpUrl: vi.fn(
      (base: string, id: string) => `${base}/v1/toolset/${id}/mcp`,
    ),
  };
});

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
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
  GhostIconButton: ({
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
  otherLocales: [],
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
      isEditMode
      onChange={vi.fn()}
      onAuthChange={vi.fn()}
      onEnsureSaved={vi.fn().mockResolvedValue(true)}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SettingsForm — endpoint field', () => {
  it('renders the endpoint error message when errors.endpoint is provided', () => {
    render(
      <SettingsForm
        form={makeForm()}
        errors={{ endpoint: 'toolsetEditor.settings.endpointRequired' }}
        isSaving={false}
        toolsetId=""
        isEditMode={false}
        onChange={vi.fn()}
        onAuthChange={vi.fn()}
        onEnsureSaved={vi.fn().mockResolvedValue(true)}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain(
      ToolsetEditorI18nKeys.EndpointRequired,
    );
  });

  it('renders HTTP and SSE as protocol radio options', () => {
    renderSettings();
    expect(screen.getByRole('radio', { name: 'HTTP' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'SSE' })).toBeTruthy();
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
    const { buildToolsetMcpUrl } = await import('@epam/ai-dial-chat-hooks');
    render(
      <SettingsForm
        form={makeForm()}
        errors={{}}
        isSaving={false}
        toolsetId=""
        isEditMode={false}
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
    const { buildToolsetMcpUrl } = await import('@epam/ai-dial-chat-hooks');
    vi.mocked(useAppConfig).mockReturnValueOnce({
      config: { dialCoreExternalUrl: null },
    } as ReturnType<typeof useAppConfig>);
    render(
      <SettingsForm
        form={makeForm()}
        errors={{}}
        isSaving={false}
        toolsetId="toolsets/b/my__1.0.0"
        isEditMode
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
    const { buildToolsetMcpUrl } = await import('@epam/ai-dial-chat-hooks');
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
