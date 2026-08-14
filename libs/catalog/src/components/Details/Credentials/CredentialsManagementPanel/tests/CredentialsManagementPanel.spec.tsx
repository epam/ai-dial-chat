import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../../../models/catalog-item';
import type { CatalogItemCredentials } from '../../../../../models/catalog-item-credentials';
import {
  CredentialsLevel,
  CredentialStatus,
  ToolsetAuthenticationType,
} from '../../../../../types/toolset-auth';
import { CredentialsManagementPanel } from '../CredentialsManagementPanel';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  Input: ({
    onChange,
    labelProps,
    error,
  }: {
    onChange: (value?: string) => void;
    labelProps?: { label?: string };
    error?: string;
  }) => (
    <div>
      <input
        aria-label={labelProps?.label}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <span>{error}</span>}
    </div>
  ),
  NeutralButton: ({
    label,
    onClick,
    disabled,
    iconBefore,
    className,
  }: {
    label?: string;
    onClick: () => void;
    disabled?: boolean;
    iconBefore?: React.ReactNode;
    className?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} className={className}>
      {iconBefore}
      {label}
    </button>
  ),
  DangerButton: ({
    label,
    onClick,
    className,
  }: {
    label?: string;
    onClick: () => void;
    className?: string;
  }) => (
    <button onClick={onClick} className={className} data-variant="danger">
      {label}
    </button>
  ),
  LinkButton: ({ label, onClick }: { label?: string; onClick: () => void }) => (
    <button onClick={onClick}>{label}</button>
  ),
  Spinner: ({ ariaLabel }: { ariaLabel?: string }) => (
    <span role="status">{ariaLabel}</span>
  ),
}));
vi.mock('@tabler/icons-react', () => ({
  IconBuildingCommunity: () => <svg />,
  IconCircleCheckFilled: () => <svg />,
  IconKey: () => <svg />,
  IconUser: () => <svg />,
}));
vi.mock('../../../../EntityHeader/EntityHeader', () => ({
  EntityHeader: ({ item }: { item: CatalogItem }) => <div>{item.name}</div>,
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const makeItem = (
  overrides?: Partial<CatalogItemCredentials>,
): CatalogItem => ({
  id: '1',
  type: CatalogEntityType.Toolset,
  name: 'sm-github-copilot',
  version: '1.0.0',
  lastUsed: 'now',
  description: '',
  folder: [],
  topics: [],
  credentials: {
    authenticationType: ToolsetAuthenticationType.OAuth,
    isManageableByAdmin: true,
    ...overrides,
  },
});

describe('CredentialsManagementPanel', () => {
  it('renders nothing when the item has no credentials', () => {
    render(
      <CredentialsManagementPanel
        item={{
          id: '1',
          type: CatalogEntityType.Toolset,
          name: 'x',
          version: '1',
          lastUsed: 'now',
          description: '',
          folder: [],
          topics: [],
        }}
      />,
    );
    expect(screen.queryByText('Personal credentials')).toBeNull();
    expect(screen.queryByText('Organization credentials')).toBeNull();
  });

  it('renders both credentials rows', () => {
    render(<CredentialsManagementPanel item={makeItem()} />);
    expect(screen.getByText('Personal credentials')).toBeTruthy();
    expect(screen.getByText('Organization credentials')).toBeTruthy();
  });

  it('shows Log in for OAuth rows that are signed out', () => {
    render(<CredentialsManagementPanel item={makeItem()} />);
    expect(screen.getAllByRole('button', { name: 'Log in' })).toHaveLength(2);
  });

  it('calls onLogin at USER level from the personal row', async () => {
    const onLogin = vi.fn();
    const item = makeItem();
    render(<CredentialsManagementPanel item={item} onLogin={onLogin} />);
    const [personalLogin] = screen.getAllByRole('button', { name: 'Log in' });
    await userEvent.click(personalLogin);
    expect(onLogin).toHaveBeenCalledWith(item, {
      level: CredentialsLevel.User,
    });
  });

  it('requests the host to show a full logout-confirmation sub-view instead of logging out directly', async () => {
    const onRequestLogout = vi.fn();
    const item = makeItem({ userStatus: CredentialStatus.SignedIn });
    render(
      <CredentialsManagementPanel
        item={item}
        onRequestLogout={onRequestLogout}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(onRequestLogout).toHaveBeenCalledWith(CredentialsLevel.User);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders Log out with a danger style', () => {
    const item = makeItem({ userStatus: CredentialStatus.SignedIn });
    render(<CredentialsManagementPanel item={item} />);
    expect(
      screen.getByRole('button', { name: 'Log out' }).dataset.variant,
    ).toBe('danger');
  });

  it('gives Log in and Log out the same fixed width', () => {
    const signedOutItem = makeItem();
    const { unmount } = render(
      <CredentialsManagementPanel item={signedOutItem} />,
    );
    const [loginButton] = screen.getAllByRole('button', { name: 'Log in' });
    const loginClassName = loginButton.className;
    unmount();

    const signedInItem = makeItem({ userStatus: CredentialStatus.SignedIn });
    render(<CredentialsManagementPanel item={signedInItem} />);
    const logoutClassName = screen.getByRole('button', {
      name: 'Log out',
    }).className;

    expect(loginClassName).toBe(logoutClassName);
  });

  it('shows an API key input for ApiKey rows that are signed out', () => {
    render(
      <CredentialsManagementPanel
        item={makeItem({
          authenticationType: ToolsetAuthenticationType.ApiKey,
        })}
      />,
    );
    expect(screen.getAllByLabelText('API key')).toHaveLength(2);
  });

  it('submits the personal API key at USER level via Add', async () => {
    const onLogin = vi.fn();
    const item = makeItem({
      authenticationType: ToolsetAuthenticationType.ApiKey,
    });
    render(<CredentialsManagementPanel item={item} onLogin={onLogin} />);

    const [personalInput] = screen.getAllByLabelText('API key');
    await userEvent.type(personalInput, 'user-key');
    const [personalAdd] = screen.getAllByRole('button', { name: 'Add' });
    await userEvent.click(personalAdd);

    expect(onLogin).toHaveBeenCalledWith(item, {
      level: CredentialsLevel.User,
      apiKey: 'user-key',
    });
  });

  it('shows a spinner in place of the Add label while saving', async () => {
    const { promise, resolve } = deferred<void>();
    const onLogin = vi.fn(() => promise);
    const item = makeItem({
      authenticationType: ToolsetAuthenticationType.ApiKey,
    });
    render(<CredentialsManagementPanel item={item} onLogin={onLogin} />);

    const [personalInput] = screen.getAllByLabelText('API key');
    await userEvent.type(personalInput, 'user-key');
    const [personalAdd] = screen.getAllByRole('button', { name: 'Add' });
    await userEvent.click(personalAdd);

    expect(personalAdd).toHaveProperty('disabled', true);
    expect(personalAdd.textContent).toBe('Adding');
    expect(screen.getAllByRole('button', { name: 'Add' })).toHaveLength(1);

    await act(async () => {
      resolve();
      await promise;
    });
  });

  it('keeps Add enabled and shows a validation error instead when submitted empty', async () => {
    const onLogin = vi.fn();
    const item = makeItem({
      authenticationType: ToolsetAuthenticationType.ApiKey,
    });
    render(<CredentialsManagementPanel item={item} onLogin={onLogin} />);

    const [personalAdd] = screen.getAllByRole('button', { name: 'Add' });
    expect(personalAdd).toHaveProperty('disabled', false);
    await userEvent.click(personalAdd);

    expect(screen.getAllByText('API key is required.').length).toBeGreaterThan(
      0,
    );
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('shows the configured message and the added caption for a signed-in API key', () => {
    const item = makeItem({
      authenticationType: ToolsetAuthenticationType.ApiKey,
      globalStatus: CredentialStatus.SignedIn,
      globalApiKeyAddedWhen: '1 week ago',
    });
    render(<CredentialsManagementPanel item={item} />);

    expect(screen.getByText('Key has been configured')).toBeTruthy();
    expect(screen.getByText('Added 1 week ago')).toBeTruthy();
  });

  it('requests the host to show a delete-confirmation sub-view instead of deleting directly', async () => {
    const onRequestDeleteApiKey = vi.fn();
    const item = makeItem({
      authenticationType: ToolsetAuthenticationType.ApiKey,
      globalStatus: CredentialStatus.SignedIn,
    });
    render(
      <CredentialsManagementPanel
        item={item}
        onRequestDeleteApiKey={onRequestDeleteApiKey}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onRequestDeleteApiKey).toHaveBeenCalledWith(CredentialsLevel.Global);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('omits the added caption but still shows the configured message when apiKeyAddedWhen is absent', () => {
    const item = makeItem({
      authenticationType: ToolsetAuthenticationType.ApiKey,
      globalStatus: CredentialStatus.SignedIn,
    });
    render(<CredentialsManagementPanel item={item} />);

    expect(screen.getByText('Key has been configured')).toBeTruthy();
    expect(screen.queryByText(/^Added/)).toBeNull();
  });

  it('uses texts.apiKeyConfiguredMessage when provided', () => {
    const item = makeItem({
      authenticationType: ToolsetAuthenticationType.ApiKey,
      globalStatus: CredentialStatus.SignedIn,
    });
    render(
      <CredentialsManagementPanel
        item={item}
        texts={{ apiKeyConfiguredMessage: 'Key configured!' }}
      />,
    );
    expect(screen.getByText('Key configured!')).toBeTruthy();
  });

  it('uses texts overrides for row labels and descriptions', () => {
    render(
      <CredentialsManagementPanel
        item={makeItem()}
        texts={{
          personalCredentialsLabel: 'Mine',
          organizationCredentialsLabel: 'Ours',
        }}
      />,
    );
    expect(screen.getByText('Mine')).toBeTruthy();
    expect(screen.getByText('Ours')).toBeTruthy();
  });

  describe('active-credential checkmark', () => {
    it('marks only the organization row active when only organization credentials are signed in', () => {
      const item = makeItem({ globalStatus: CredentialStatus.SignedIn });
      render(<CredentialsManagementPanel item={item} />);

      expect(screen.getByText('Signed out')).toBeTruthy();
      expect(screen.getByText('Signed in')).toBeTruthy();
    });

    it('marks only the personal row active when both personal and organization credentials are signed in', () => {
      const item = makeItem({
        userStatus: CredentialStatus.SignedIn,
        globalStatus: CredentialStatus.SignedIn,
      });
      render(<CredentialsManagementPanel item={item} />);

      expect(screen.getAllByText('Signed in')).toHaveLength(1);
      expect(screen.getAllByText('Signed out')).toHaveLength(1);
    });

    it('marks neither row active when both are signed out', () => {
      const item = makeItem();
      render(<CredentialsManagementPanel item={item} />);

      expect(screen.queryByText('Signed in')).toBeNull();
      expect(screen.getAllByText('Signed out')).toHaveLength(2);
    });
  });
});
