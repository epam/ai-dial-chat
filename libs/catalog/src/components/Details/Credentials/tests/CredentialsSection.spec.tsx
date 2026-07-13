import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../../models/catalog-item';
import { CatalogEntityType } from '../../../../types/entity-type';
import {
  CredentialsLevel,
  CredentialStatus,
  ToolsetAuthenticationType,
} from '../../../../types/toolset-auth';
import { CredentialsSection } from '../CredentialsSection';

vi.mock('@epam/ai-dial-kit', () => ({
  PrimaryButton: ({
    label,
    onClick,
    disabled,
  }: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
  NeutralButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => <button onClick={onClick}>{label}</button>,
  Input: ({
    onChange,
    labelProps,
    caption,
  }: {
    onChange: (value?: string) => void;
    labelProps?: { label?: string };
    caption?: string;
  }) => (
    <div>
      <input
        aria-label={labelProps?.label}
        onChange={(e) => onChange(e.target.value)}
      />
      {caption && <span>{caption}</span>}
    </div>
  ),
}));
vi.mock('@epam/ai-dial-ui-kit', () => ({
  DialConfirmationPopup: ({
    open,
    onConfirm,
    onCancel,
    header,
  }: {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    header: string;
  }) =>
    open ? (
      <div role="dialog" aria-label={header}>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
  DialAccordion: ({
    title,
    expanded,
    onToggle,
    children,
  }: {
    title: string;
    expanded?: boolean;
    onToggle?: (expanded: boolean) => void;
    children?: React.ReactNode;
  }) => (
    <section>
      <button onClick={() => onToggle?.(!expanded)}>{title}</button>
      {expanded && children}
    </section>
  ),
}));

const makeItem = (overrides?: Partial<CatalogItem>): CatalogItem => ({
  id: '1',
  type: CatalogEntityType.Toolset,
  name: 'My Toolset',
  version: '1',
  lastUsed: 'now',
  description: '',
  folder: [],
  topics: [],
  ...overrides,
});

describe('CredentialsSection', () => {
  it('renders nothing when the item has no credentials', () => {
    const { container } = render(<CredentialsSection item={makeItem()} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows an API key input and submits it via onLogin at GLOBAL level', async () => {
    const onLogin = vi.fn();
    const item = makeItem({
      credentials: {
        authenticationType: ToolsetAuthenticationType.ApiKey,
        globalStatus: CredentialStatus.SignedOut,
      },
    });
    render(<CredentialsSection item={item} onLogin={onLogin} />);

    expect(screen.getByRole('button', { name: 'Log in' })).toHaveProperty(
      'disabled',
      true,
    );
    await userEvent.type(screen.getByLabelText('API key'), 'secret-key');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(onLogin).toHaveBeenCalledWith(item, {
      level: CredentialsLevel.Global,
      apiKey: 'secret-key',
    });
  });

  it('submits at USER level for a public item not signed in personally', async () => {
    const onLogin = vi.fn();
    const item = makeItem({
      credentials: {
        authenticationType: ToolsetAuthenticationType.ApiKey,
        isPublic: true,
        globalStatus: CredentialStatus.SignedIn,
      },
    });
    render(<CredentialsSection item={item} onLogin={onLogin} />);

    await userEvent.type(screen.getByLabelText('API key'), 'secret-key');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(onLogin).toHaveBeenCalledWith(item, {
      level: CredentialsLevel.User,
      apiKey: 'secret-key',
    });
  });

  it('shows the API key hint naming the header', () => {
    const item = makeItem({
      credentials: {
        authenticationType: ToolsetAuthenticationType.ApiKey,
        apiKeyHeader: 'X-Api-Key',
      },
    });
    render(<CredentialsSection item={item} onLogin={vi.fn()} />);
    expect(
      screen.getByText('Enter your API key value for "X-Api-Key" header'),
    ).toBeTruthy();
  });

  it('calls onLogin with no apiKey for OAuth toolsets', async () => {
    const onLogin = vi.fn();
    const item = makeItem({
      credentials: {
        authenticationType: ToolsetAuthenticationType.OAuth,
        globalStatus: CredentialStatus.SignedOut,
      },
    });
    render(<CredentialsSection item={item} onLogin={onLogin} />);

    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(onLogin).toHaveBeenCalledWith(item, {
      level: CredentialsLevel.Global,
    });
  });

  it('requires confirmation before calling onLogout', async () => {
    const onLogout = vi.fn();
    const item = makeItem({
      credentials: {
        authenticationType: ToolsetAuthenticationType.ApiKey,
        globalStatus: CredentialStatus.SignedIn,
      },
    });
    render(<CredentialsSection item={item} onLogout={onLogout} />);

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(onLogout).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onLogout).toHaveBeenCalledWith(item, {
      level: CredentialsLevel.Global,
    });
  });

  it('does not call onLogout when the confirmation is cancelled', async () => {
    const onLogout = vi.fn();
    const item = makeItem({
      credentials: {
        authenticationType: ToolsetAuthenticationType.ApiKey,
        globalStatus: CredentialStatus.SignedIn,
      },
    });
    render(<CredentialsSection item={item} onLogout={onLogout} />);

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onLogout).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders both USER and GLOBAL accordions when isManageableByAdmin is true', () => {
    const item = makeItem({
      credentials: {
        authenticationType: ToolsetAuthenticationType.ApiKey,
        isManageableByAdmin: true,
        userStatus: CredentialStatus.SignedOut,
        globalStatus: CredentialStatus.SignedIn,
      },
    });
    render(
      <CredentialsSection item={item} onLogin={vi.fn()} onLogout={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'My credentials' })).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Entire organization credentials',
      }),
    ).toBeTruthy();
  });

  it('submits the USER-level accordion form with level USER', async () => {
    const onLogin = vi.fn();
    const item = makeItem({
      credentials: {
        authenticationType: ToolsetAuthenticationType.ApiKey,
        isManageableByAdmin: true,
        userStatus: CredentialStatus.SignedOut,
        globalStatus: CredentialStatus.SignedOut,
      },
    });
    render(<CredentialsSection item={item} onLogin={onLogin} />);

    await userEvent.type(screen.getByLabelText('API key'), 'user-key');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(onLogin).toHaveBeenCalledWith(item, {
      level: CredentialsLevel.User,
      apiKey: 'user-key',
    });
  });
});
