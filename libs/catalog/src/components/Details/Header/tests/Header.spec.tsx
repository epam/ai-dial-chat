import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  cloneElement,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../../models/catalog-item';
import { CatalogEntityType } from '../../../../types/entity-type';
import {
  CredentialStatus,
  ToolsetAuthenticationType,
} from '../../../../types/toolset-auth';
import { Header } from '../Header';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  Spinner: () => <svg />,
  FolderPath: () => <div />,
  PrimaryButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => (
    <button className="primary" onClick={onClick}>
      {label}
    </button>
  ),
  NeutralButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => (
    <button className="neutral" onClick={onClick}>
      {label}
    </button>
  ),
  NeutralIconButton: ({
    'aria-label': ariaLabel,
    onClick,
  }: {
    'aria-label'?: string;
    onClick?: () => void;
  }) => <button aria-label={ariaLabel} onClick={onClick} />,
  Dropdown: ({
    children,
    items,
  }: {
    children: ReactElement<{ onClick?: () => void }>;
    items: Array<{
      key: string;
      label: ReactNode;
      disabled?: boolean;
      onClick?: () => void;
    }>;
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <div>
        {cloneElement(children, {
          onClick: () => setIsOpen((value) => !value),
        })}
        {isOpen &&
          items.map((item) => (
            <button
              key={item.key}
              disabled={item.disabled}
              onClick={item.onClick}
            >
              {item.label}
            </button>
          ))}
      </div>
    );
  },
}));
vi.mock('@tabler/icons-react', () => ({
  IconDots: () => <svg />,
  IconDownload: () => <svg />,
  IconKey: () => <svg />,
  IconLogin: () => <svg />,
  IconLogout: () => <svg />,
  IconPencil: () => <svg />,
  IconPlayerPlayFilled: () => <svg />,
  IconTrash: () => <svg />,
  IconUpload: () => <svg />,
  IconUserOff: () => <svg />,
}));
vi.mock('../../../EntityHeader/EntityHeader', () => ({
  EntityHeader: ({ item }: { item: CatalogItem }) => <div>{item.name}</div>,
}));
vi.mock('../ShareButton/ShareButton', () => ({
  ShareButton: ({ label }: { label?: string }) => (
    <button>{label ?? 'Share'}</button>
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
    render(<Header item={makeItem(CatalogEntityType.Agent)} />);
    expect(screen.getByRole('button', { name: 'Use in chat' })).toBeTruthy();
  });

  it('renders Use in chat for a Prompt item', () => {
    render(<Header item={makeItem(CatalogEntityType.Prompt)} />);
    expect(screen.getByRole('button', { name: 'Use in chat' })).toBeTruthy();
  });

  it('does not render Publish for a Prompt item by default', async () => {
    render(<Header item={makeItem(CatalogEntityType.Prompt)} />);
    await openManage();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
  });

  it('does not render Use in chat for a Toolset item', () => {
    render(<Header item={makeItem(CatalogEntityType.Toolset)} />);
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

  const openManage = async (label = 'Manage') => {
    await userEvent.click(screen.getByRole('button', { name: label }));
  };

  it('does not render the Manage button for a Model item the user cannot edit, publish, or delete', () => {
    render(
      <Header
        item={{ ...makeItem(CatalogEntityType.Model), isMyApp: false }}
        isPublishVisible={() => false}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Manage' })).toBeNull();
  });

  it('renders Publish inside the Manage menu for a Model item', async () => {
    render(<Header item={makeItem(CatalogEntityType.Model)} />);
    await openManage();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeTruthy();
  });

  it('renders Publish inside the Manage menu for a Toolset item by default', async () => {
    render(<Header item={makeItem(CatalogEntityType.Toolset)} />);
    await openManage();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeTruthy();
  });

  it('uses the publish visibility predicate', async () => {
    render(
      <Header
        item={makeItem(CatalogEntityType.Toolset)}
        isPublishVisible={() => false}
      />,
    );
    await openManage();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
  });

  it('calls onOpenPublish when Publish is clicked in the Manage menu', async () => {
    const onOpenPublish = vi.fn();
    render(
      <Header
        item={makeItem(CatalogEntityType.Model)}
        onOpenPublish={onOpenPublish}
      />,
    );
    await openManage();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(onOpenPublish).toHaveBeenCalledOnce();
  });

  it('does not render the Manage button when onEdit is not supplied and no other action applies', () => {
    render(
      <Header
        item={{
          ...makeItem(CatalogEntityType.Agent),
          isEditable: true,
          isMyApp: false,
        }}
        isPublishVisible={() => false}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Manage' })).toBeNull();
  });

  it('does not render Edit in the Manage menu when the item is not editable', async () => {
    render(
      <Header
        item={{ ...makeItem(CatalogEntityType.Agent), isEditable: false }}
        onEdit={vi.fn()}
      />,
    );
    await openManage();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('renders Edit in the Manage menu when onEdit is supplied and the item is editable', async () => {
    render(
      <Header
        item={{ ...makeItem(CatalogEntityType.Agent), isEditable: true }}
        onEdit={vi.fn()}
      />,
    );
    await openManage();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  });

  it('uses editActionLabel for the Edit item label', async () => {
    render(
      <Header
        item={{ ...makeItem(CatalogEntityType.Agent), isEditable: true }}
        onEdit={vi.fn()}
        texts={{ editActionLabel: 'Modify' }}
      />,
    );
    await openManage();
    expect(screen.getByRole('button', { name: 'Modify' })).toBeTruthy();
  });

  it('calls onEdit with the item when Edit is clicked in the Manage menu', async () => {
    const onEdit = vi.fn();
    const item = {
      ...makeItem(CatalogEntityType.Agent),
      isEditable: true,
    };
    render(<Header item={item} onEdit={onEdit} />);
    await openManage();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith(item);
  });

  it('renders Download in the Manage menu when onDownload is supplied', async () => {
    render(
      <Header item={makeItem(CatalogEntityType.Prompt)} onDownload={vi.fn()} />,
    );
    await openManage();
    expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy();
  });

  it('does not render Download when onDownload is absent', async () => {
    render(<Header item={makeItem(CatalogEntityType.Prompt)} />);
    await openManage();
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });

  it('does not render Download when isDownloadVisible returns false', async () => {
    render(
      <Header
        item={makeItem(CatalogEntityType.Toolset)}
        onDownload={vi.fn()}
        isDownloadVisible={() => false}
      />,
    );
    await openManage();
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });

  it('passes texts.downloadActionLabel through to the Download item label', async () => {
    render(
      <Header
        item={makeItem(CatalogEntityType.Prompt)}
        onDownload={vi.fn()}
        texts={{ downloadActionLabel: 'Export' }}
      />,
    );
    await openManage();
    expect(screen.getByRole('button', { name: 'Export' })).toBeTruthy();
  });

  it('calls onDownload with the item when Download is clicked', async () => {
    const onDownload = vi.fn();
    const item = makeItem(CatalogEntityType.Prompt);
    render(<Header item={item} onDownload={onDownload} />);
    await openManage();
    await userEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(onDownload).toHaveBeenCalledWith(item);
  });

  it('renders Delete in the Manage menu', async () => {
    render(<Header item={makeItem(CatalogEntityType.Toolset)} />);
    await openManage();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('does not render Delete in the Manage menu for an item the user does not own', async () => {
    render(
      <Header
        item={{ ...makeItem(CatalogEntityType.Toolset), isMyApp: false }}
      />,
    );
    await openManage();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('passes texts.deleteActionLabel through to the Delete item label', async () => {
    render(
      <Header
        item={makeItem(CatalogEntityType.Toolset)}
        texts={{ deleteActionLabel: 'Remove' }}
      />,
    );
    await openManage();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
  });

  it('calls onDelete with the item when Delete is clicked in the Manage menu', async () => {
    const onDelete = vi.fn();
    const item = makeItem(CatalogEntityType.Toolset);
    render(<Header item={item} onDelete={onDelete} />);
    await openManage();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(item);
  });

  /*
   * The details panel owns the delete confirmation step, so the menu entry
   * only requests it — it never performs the delete or shows progress here.
   */
  it('leaves Delete enabled after it is clicked, since the panel takes over', async () => {
    render(
      <Header item={makeItem(CatalogEntityType.Toolset)} onDelete={vi.fn()} />,
    );
    await openManage();
    const deleteItem = screen.getByRole('button', { name: 'Delete' });
    await userEvent.click(deleteItem);
    expect(deleteItem.hasAttribute('disabled')).toBe(false);
  });

  const makeSharedItem = (type = CatalogEntityType.Toolset): CatalogItem => ({
    ...makeItem(type),
    isMyApp: false,
    sharedWithMe: true,
  });

  it('renders Remove from My List in the Manage menu for an item shared with the user', async () => {
    render(<Header item={makeSharedItem()} onUnshare={vi.fn()} />);
    await openManage();
    expect(
      screen.getByRole('button', { name: 'Remove from My List' }),
    ).toBeTruthy();
  });

  it('does not render Remove from My List when isUnshareVisible returns false', async () => {
    render(
      <Header
        item={makeSharedItem()}
        onUnshare={vi.fn()}
        isUnshareVisible={() => false}
      />,
    );
    await openManage();
    expect(
      screen.queryByRole('button', { name: 'Remove from My List' }),
    ).toBeNull();
  });

  it('still renders Remove from My List when isUnshareVisible returns true', async () => {
    render(
      <Header
        item={makeSharedItem()}
        onUnshare={vi.fn()}
        isUnshareVisible={() => true}
      />,
    );
    await openManage();
    expect(
      screen.getByRole('button', { name: 'Remove from My List' }),
    ).toBeTruthy();
  });

  it('does not render Remove from My List for an item the user owns', async () => {
    render(
      <Header item={makeItem(CatalogEntityType.Toolset)} onUnshare={vi.fn()} />,
    );
    await openManage();
    expect(
      screen.queryByRole('button', { name: 'Remove from My List' }),
    ).toBeNull();
  });

  it('does not render Remove from My List when onUnshare is not supplied', async () => {
    render(<Header item={makeSharedItem()} isPublishVisible={() => true} />);
    await openManage();
    expect(
      screen.queryByRole('button', { name: 'Remove from My List' }),
    ).toBeNull();
  });

  it('passes texts.unshareLabel through to the Remove from My List item label', async () => {
    render(
      <Header
        item={makeSharedItem()}
        onUnshare={vi.fn()}
        texts={{ unshareLabel: 'Stop sharing' }}
      />,
    );
    await openManage();
    expect(screen.getByRole('button', { name: 'Stop sharing' })).toBeTruthy();
  });

  it('calls onUnshare with the item when Remove from My List is clicked', async () => {
    const onUnshare = vi.fn();
    const item = makeSharedItem();
    render(<Header item={item} onUnshare={onUnshare} />);
    await openManage();
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove from My List' }),
    );
    expect(onUnshare).toHaveBeenCalledWith(item);
  });

  it('renders Remove from My List for a shared Application item', async () => {
    render(
      <Header
        item={makeSharedItem(CatalogEntityType.Agent)}
        onUnshare={vi.fn()}
      />,
    );
    await openManage();
    expect(
      screen.getByRole('button', { name: 'Remove from My List' }),
    ).toBeTruthy();
  });

  it('renders Revoke access in the Manage menu for an item the user owns', async () => {
    render(
      <Header
        item={makeItem(CatalogEntityType.Toolset)}
        onRevokeShare={vi.fn()}
      />,
    );
    await openManage();
    expect(screen.getByRole('button', { name: 'Revoke access' })).toBeTruthy();
  });

  it('does not render Revoke access for an item shared with the user', async () => {
    render(<Header item={makeSharedItem()} onRevokeShare={vi.fn()} />);
    await openManage();
    expect(screen.queryByRole('button', { name: 'Revoke access' })).toBeNull();
  });

  it('does not render Revoke access when onRevokeShare is not supplied', async () => {
    render(<Header item={makeItem(CatalogEntityType.Toolset)} />);
    await openManage();
    expect(screen.queryByRole('button', { name: 'Revoke access' })).toBeNull();
  });

  it('passes texts.revokeShareLabel through to the Revoke access item label', async () => {
    render(
      <Header
        item={makeItem(CatalogEntityType.Toolset)}
        onRevokeShare={vi.fn()}
        texts={{ revokeShareLabel: 'Stop sharing with everyone' }}
      />,
    );
    await openManage();
    expect(
      screen.getByRole('button', { name: 'Stop sharing with everyone' }),
    ).toBeTruthy();
  });

  it('calls onRevokeShare with the item when Revoke access is clicked', async () => {
    const onRevokeShare = vi.fn();
    const item = makeItem(CatalogEntityType.Toolset);
    render(<Header item={item} onRevokeShare={onRevokeShare} />);
    await openManage();
    await userEvent.click(
      screen.getByRole('button', { name: 'Revoke access' }),
    );
    expect(onRevokeShare).toHaveBeenCalledWith(item);
  });

  it('hides Revoke access for an owned item nobody currently holds access to', async () => {
    render(
      <Header
        item={{ ...makeItem(CatalogEntityType.Toolset), recipientsCount: 0 }}
        onRevokeShare={vi.fn()}
      />,
    );
    await openManage();
    expect(screen.queryByRole('button', { name: 'Revoke access' })).toBeNull();
  });

  it('shows the recipient count in the Revoke access label when it is known', async () => {
    render(
      <Header
        item={{ ...makeItem(CatalogEntityType.Toolset), recipientsCount: 3 }}
        onRevokeShare={vi.fn()}
      />,
    );
    await openManage();
    expect(
      screen.getByRole('button', { name: 'Revoke access (3)' }),
    ).toBeTruthy();
  });

  it('uses texts.revokeShareLabelWithCount to format the counted label', async () => {
    render(
      <Header
        item={{ ...makeItem(CatalogEntityType.Toolset), recipientsCount: 2 }}
        onRevokeShare={vi.fn()}
        texts={{
          revokeShareLabelWithCount: (count) => `Отозвать у ${count} человек`,
        }}
      />,
    );
    await openManage();
    expect(
      screen.getByRole('button', { name: 'Отозвать у 2 человек' }),
    ).toBeTruthy();
  });

  it('keeps Revoke access visible with an uncounted label when the count is unknown', async () => {
    render(
      <Header
        item={makeItem(CatalogEntityType.Toolset)}
        onRevokeShare={vi.fn()}
      />,
    );
    await openManage();
    expect(screen.getByRole('button', { name: 'Revoke access' })).toBeTruthy();
  });

  it('keeps Revoke access in the Manage menu under dir="rtl"', async () => {
    document.documentElement.dir = 'rtl';
    try {
      render(
        <Header
          item={makeItem(CatalogEntityType.Toolset)}
          onRevokeShare={vi.fn()}
        />,
      );
      await openManage();
      expect(
        screen.getByRole('button', { name: 'Revoke access' }),
      ).toBeTruthy();
    } finally {
      document.documentElement.dir = 'ltr';
    }
  });

  it('renders Revoke access alongside Delete for an owned item', async () => {
    render(
      <Header
        item={makeItem(CatalogEntityType.Toolset)}
        onDelete={vi.fn()}
        onRevokeShare={vi.fn()}
      />,
    );
    await openManage();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Revoke access' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Remove from My List' }),
    ).toBeNull();
  });

  it('uses manageActionLabel for the Manage button accessible name', () => {
    render(
      <Header
        item={makeItem(CatalogEntityType.Toolset)}
        texts={{ manageActionLabel: 'More actions' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'More actions' })).toBeTruthy();
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

  it('renders the credentials button as the primary action, first in the action row, for a Toolset item', () => {
    const { container } = render(
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

    const buttons = screen.getAllByRole('button');
    expect(buttons[0].textContent).toBe('Log in');
    expect(container.querySelector('.primary')?.textContent).toBe('Log in');
  });

  it('keeps the credentials button as a non-primary, non-leading action for a non-Toolset item', () => {
    render(
      <Header
        item={{
          ...makeItem(CatalogEntityType.Agent),
          credentials: {
            authenticationType: ToolsetAuthenticationType.ApiKey,
            userStatus: CredentialStatus.SignedOut,
          },
        }}
        onLogin={vi.fn()}
      />,
    );

    const logInButton = screen.getByRole('button', { name: 'Log in' });
    expect(logInButton.className).toBe('neutral');
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
