import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../../models/catalog-item';
import { CatalogEntityType } from '../../../../types/entity-type';
import {
  CredentialStatus,
  ToolsetAuthenticationType,
} from '../../../../types/toolset-auth';
import { Header } from '../Header';

vi.mock('@epam/ai-dial-kit', () => ({
  PrimaryButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => <button onClick={onClick}>{label}</button>,
  NeutralButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => <button onClick={onClick}>{label}</button>,
  GhostButton: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button onClick={onClick}>{label}</button>
  ),
}));
vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
}));
vi.mock('@tabler/icons-react', () => ({
  IconKey: () => <svg />,
  IconLogin: () => <svg />,
  IconLogout: () => <svg />,
  IconPencil: () => <svg />,
  IconPlayerPlayFilled: () => <svg />,
}));
vi.mock('../../../EntityHeader/EntityHeader', () => ({
  EntityHeader: ({ item }: { item: CatalogItem }) => <div>{item.name}</div>,
}));
vi.mock('../../../FolderPath/FolderPath', () => ({
  FolderPath: () => <div />,
}));
vi.mock('../ShareButton/ShareButton', () => ({
  ShareButton: ({
    label,
    onUnshare,
    unshareLabel,
    item,
  }: {
    label?: string;
    onUnshare?: (item: CatalogItem) => void;
    unshareLabel?: string;
    item: CatalogItem;
  }) => (
    <>
      <button>{label ?? 'Share'}</button>
      {onUnshare && (
        <button onClick={() => onUnshare(item)}>
          {unshareLabel ?? 'Delete'}
        </button>
      )}
    </>
  ),
}));
vi.mock('../DeleteButton/DeleteButton', () => ({
  DeleteButton: ({
    onDelete,
    texts,
  }: {
    onDelete?: (item: CatalogItem) => void;
    texts?: { deleteActionLabel?: string };
  }) => (
    <button onClick={() => onDelete?.({} as CatalogItem)}>
      {texts?.deleteActionLabel ?? 'Delete'}
    </button>
  ),
}));

const makeItem = (type: CatalogEntityType): CatalogItem => ({
  id: '1',
  type,
  name: 'Claude',
  version: '1',
  lastUsed: 'now',
  description: '',
  folder: [],
  topics: [],
  isMyApp: true,
});

describe('Header', () => {
  it('renders Use in chat for a Model item', () => {
    render(<Header item={makeItem(CatalogEntityType.Model)} />);
    expect(screen.getByRole('button', { name: 'Use in chat' })).toBeTruthy();
  });

  it('renders Use in chat for an Application item', () => {
    render(<Header item={makeItem(CatalogEntityType.Application)} />);
    expect(screen.getByRole('button', { name: 'Use in chat' })).toBeTruthy();
  });

  it('does not render Use in chat for a Toolset item', () => {
    render(<Header item={makeItem(CatalogEntityType.Toolset)} />);
    expect(screen.queryByRole('button', { name: 'Use in chat' })).toBeNull();
  });

  it('does not render Use in chat for non-selectable entity types by default', () => {
    render(<Header item={makeItem(CatalogEntityType.Agent)} />);
    expect(screen.queryByRole('button', { name: 'Use in chat' })).toBeNull();
  });

  it('hides Use in chat when hasPrimaryAction is false', () => {
    render(
      <Header
        item={makeItem(CatalogEntityType.Model)}
        texts={{ hasPrimaryAction: false }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Use in chat' })).toBeNull();
  });

  it('uses the primary action visibility predicate', () => {
    render(
      <Header
        item={makeItem(CatalogEntityType.Toolset)}
        isPrimaryActionVisible={() => true}
      />,
    );
    expect(screen.getByRole('button', { name: 'Use in chat' })).toBeTruthy();
  });

  it('uses primaryActionLabel for the primary action label', () => {
    render(
      <Header
        item={makeItem(CatalogEntityType.Model)}
        texts={{
          primaryActionLabel: 'Open chat',
        }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Open chat' })).toBeTruthy();
  });

  it('calls onUseInChat with the item when Use in chat is clicked', async () => {
    const onUseInChat = vi.fn();
    const item = makeItem(CatalogEntityType.Model);
    render(<Header item={item} onUseInChat={onUseInChat} />);
    await userEvent.click(screen.getByRole('button', { name: 'Use in chat' }));
    expect(onUseInChat).toHaveBeenCalledWith(item);
  });

  it('renders the Share button', () => {
    render(<Header item={makeItem(CatalogEntityType.Toolset)} />);
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
  });

  it('passes texts.shareLabel through to the Share button label', () => {
    render(
      <Header
        item={makeItem(CatalogEntityType.Toolset)}
        texts={{ shareLabel: 'Share this' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Share this' })).toBeTruthy();
  });

  it('renders Publish for a Model item', () => {
    render(<Header item={makeItem(CatalogEntityType.Model)} />);
    expect(screen.getByRole('button', { name: 'Publish' })).toBeTruthy();
  });

  it('renders Publish for a Toolset item by default', () => {
    render(<Header item={makeItem(CatalogEntityType.Toolset)} />);
    expect(screen.getByRole('button', { name: 'Publish' })).toBeTruthy();
  });

  it('uses the publish visibility predicate', () => {
    render(
      <Header
        item={makeItem(CatalogEntityType.Toolset)}
        isPublishVisible={() => false}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
  });

  it('calls onOpenPublish when Publish is clicked', async () => {
    const onOpenPublish = vi.fn();
    render(
      <Header
        item={makeItem(CatalogEntityType.Model)}
        onOpenPublish={onOpenPublish}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(onOpenPublish).toHaveBeenCalledOnce();
  });

  it('does not render Edit when onEdit is not supplied', () => {
    render(
      <Header
        item={{ ...makeItem(CatalogEntityType.Application), isEditable: true }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('does not render Edit when the item is not editable', () => {
    render(
      <Header
        item={{ ...makeItem(CatalogEntityType.Application), isEditable: false }}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('renders Edit when onEdit is supplied and the item is editable', () => {
    render(
      <Header
        item={{ ...makeItem(CatalogEntityType.Application), isEditable: true }}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  });

  it('uses editActionLabel for the Edit button label', () => {
    render(
      <Header
        item={{ ...makeItem(CatalogEntityType.Application), isEditable: true }}
        onEdit={vi.fn()}
        texts={{ editActionLabel: 'Modify' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Modify' })).toBeTruthy();
  });

  it('calls onEdit with the item when Edit is clicked', async () => {
    const onEdit = vi.fn();
    const item = {
      ...makeItem(CatalogEntityType.Application),
      isEditable: true,
    };
    render(<Header item={item} onEdit={onEdit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith(item);
  });

  it('renders the Delete button', () => {
    render(<Header item={makeItem(CatalogEntityType.Toolset)} />);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('passes texts.deleteActionLabel through to the Delete button label', () => {
    render(
      <Header
        item={makeItem(CatalogEntityType.Toolset)}
        texts={{ deleteActionLabel: 'Remove' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
  });

  it('calls onDelete with the item when Delete is clicked', async () => {
    const onDelete = vi.fn();
    const item = makeItem(CatalogEntityType.Toolset);
    render(<Header item={item} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('threads onUnshare and unshareLabel through to ShareButton', async () => {
    const onUnshare = vi.fn();
    const item = { ...makeItem(CatalogEntityType.Application), isMyApp: true };
    render(
      <Header
        item={item}
        onUnshare={onUnshare}
        texts={{ unshareLabel: 'Stop sharing' }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Stop sharing' }));
    expect(onUnshare).toHaveBeenCalledWith(item);
  });

  it('positions Delete immediately after Share in the action row', () => {
    render(<Header item={makeItem(CatalogEntityType.Toolset)} />);
    const labels = screen
      .getAllByRole('button')
      .map((button) => button.textContent);
    const shareIndex = labels.indexOf('Share');
    const deleteIndex = labels.indexOf('Delete');
    expect(deleteIndex).toBe(shareIndex + 1);
  });

  it('does not render a credentials button when the item has no credentials', () => {
    render(
      <Header
        item={makeItem(CatalogEntityType.Toolset)}
        onLogin={vi.fn()}
        onLogout={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Log in' })).toBeNull();
  });

  it('does not render a credentials button when authenticationType is NONE', () => {
    render(
      <Header
        item={{
          ...makeItem(CatalogEntityType.Toolset),
          credentials: { authenticationType: ToolsetAuthenticationType.None },
        }}
        onLogin={vi.fn()}
        onLogout={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Log in' })).toBeNull();
  });

  it('renders Log in when not signed in at any level', () => {
    render(
      <Header
        item={{
          ...makeItem(CatalogEntityType.Toolset),
          credentials: {
            authenticationType: ToolsetAuthenticationType.ApiKey,
            userStatus: CredentialStatus.SignedOut,
          },
        }}
        onLogin={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy();
  });

  it('renders Log out when signed in at USER level', () => {
    render(
      <Header
        item={{
          ...makeItem(CatalogEntityType.Toolset),
          credentials: {
            authenticationType: ToolsetAuthenticationType.ApiKey,
            userStatus: CredentialStatus.SignedIn,
          },
        }}
        onLogout={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy();
  });

  it('renders Login with my creds for a public item not signed in at USER level', () => {
    render(
      <Header
        item={{
          ...makeItem(CatalogEntityType.Toolset),
          credentials: {
            authenticationType: ToolsetAuthenticationType.ApiKey,
            isPublic: true,
            globalStatus: CredentialStatus.SignedIn,
          },
        }}
        onLogin={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Login with my creds' }),
    ).toBeTruthy();
  });

  it('renders Manage credentials when isManageableByAdmin is true', () => {
    render(
      <Header
        item={{
          ...makeItem(CatalogEntityType.Toolset),
          credentials: {
            authenticationType: ToolsetAuthenticationType.ApiKey,
            isManageableByAdmin: true,
          },
        }}
        onLogin={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Manage credentials' }),
    ).toBeTruthy();
  });

  it('calls onToggleCredentials when the credentials button is clicked in a non-logout state', async () => {
    const onToggleCredentials = vi.fn();
    render(
      <Header
        item={{
          ...makeItem(CatalogEntityType.Toolset),
          credentials: {
            authenticationType: ToolsetAuthenticationType.ApiKey,
            userStatus: CredentialStatus.SignedOut,
          },
        }}
        onLogin={vi.fn()}
        onToggleCredentials={onToggleCredentials}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(onToggleCredentials).toHaveBeenCalledOnce();
  });

  it('calls onRequestLogout instead of onToggleCredentials when signed in', async () => {
    const onToggleCredentials = vi.fn();
    const onRequestLogout = vi.fn();
    render(
      <Header
        item={{
          ...makeItem(CatalogEntityType.Toolset),
          credentials: {
            authenticationType: ToolsetAuthenticationType.ApiKey,
            userStatus: CredentialStatus.SignedIn,
          },
        }}
        onLogout={vi.fn()}
        onToggleCredentials={onToggleCredentials}
        onRequestLogout={onRequestLogout}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(onRequestLogout).toHaveBeenCalledOnce();
    expect(onToggleCredentials).not.toHaveBeenCalled();
  });
});
