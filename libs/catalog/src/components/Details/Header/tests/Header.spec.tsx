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
  DialSpinner: () => <svg />,
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
  DialDropdown: ({
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
  IconKey: () => <svg />,
  IconLogin: () => <svg />,
  IconLogout: () => <svg />,
  IconPencil: () => <svg />,
  IconPlayerPlayFilled: () => <svg />,
  IconTrash: () => <svg />,
  IconUpload: () => <svg />,
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
        item={makeItem(CatalogEntityType.Model)}
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

  it('calls onCloseDetails after a successful delete from the Manage menu', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onCloseDetails = vi.fn();
    render(
      <Header
        item={makeItem(CatalogEntityType.Toolset)}
        onDelete={onDelete}
        onCloseDetails={onCloseDetails}
      />,
    );
    await openManage();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onCloseDetails).toHaveBeenCalledOnce();
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
