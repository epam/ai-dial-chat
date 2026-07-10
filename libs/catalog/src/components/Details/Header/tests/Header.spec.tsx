import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../../models/catalog-item';
import { CatalogEntityType } from '../../../../types/entity-type';
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
}));
vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  DialDropdown: ({
    children,
    open,
    renderOverlay,
  }: {
    children: ReactNode;
    open?: boolean;
    renderOverlay?: () => ReactNode;
  }) => (
    <div>
      {children}
      {open && renderOverlay?.()}
    </div>
  ),
}));
vi.mock('@tabler/icons-react', () => ({
  IconChevronDown: () => <svg />,
  IconPencil: () => <svg />,
  IconPlayerPlayFilled: () => <svg />,
  IconShare: () => <svg />,
}));
vi.mock('../../../EntityHeader/EntityHeader', () => ({
  EntityHeader: ({ item }: { item: CatalogItem }) => <div>{item.name}</div>,
}));
vi.mock('../../../FolderPath/FolderPath', () => ({
  FolderPath: () => <div />,
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

  it('still renders Share for a Toolset item', () => {
    render(<Header item={makeItem(CatalogEntityType.Toolset)} />);
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
  });

  it('hides Share for a Guardrail item', () => {
    render(<Header item={makeItem(CatalogEntityType.Guardrail)} />);
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('hides Share for an MCP item', () => {
    render(<Header item={makeItem(CatalogEntityType.Mcp)} />);
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('calls onShare with the item when Share is clicked', async () => {
    const onShare = vi.fn();
    const item = makeItem(CatalogEntityType.Model);
    render(<Header item={item} onShare={onShare} />);
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(onShare).toHaveBeenCalledWith(item);
  });

  describe('shareOverlay', () => {
    it('opens the share popover instead of calling onShare when shareOverlay is provided', async () => {
      const onShare = vi.fn();
      const shareOverlay = vi.fn((_item: CatalogItem, onClose: () => void) => (
        <button onClick={onClose}>close popover</button>
      ));
      const item = makeItem(CatalogEntityType.Model);
      render(
        <Header item={item} onShare={onShare} shareOverlay={shareOverlay} />,
      );

      expect(
        screen.queryByRole('button', { name: 'close popover' }),
      ).toBeNull();

      await userEvent.click(screen.getByRole('button', { name: 'Share' }));

      expect(onShare).not.toHaveBeenCalled();
      expect(shareOverlay).toHaveBeenCalledWith(item, expect.any(Function));
      expect(
        screen.getByRole('button', { name: 'close popover' }),
      ).toBeTruthy();
    });

    it('closes the popover when the overlay calls its onClose callback', async () => {
      const shareOverlay = (_item: CatalogItem, onClose: () => void) => (
        <button onClick={onClose}>close popover</button>
      );
      render(
        <Header
          item={makeItem(CatalogEntityType.Model)}
          shareOverlay={shareOverlay}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Share' }));
      await userEvent.click(
        screen.getByRole('button', { name: 'close popover' }),
      );

      expect(
        screen.queryByRole('button', { name: 'close popover' }),
      ).toBeNull();
    });

    it('toggles the popover closed when Share is clicked again', async () => {
      const shareOverlay = () => <div>popover body</div>;
      render(
        <Header
          item={makeItem(CatalogEntityType.Model)}
          shareOverlay={shareOverlay}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Share' }));
      expect(screen.getByText('popover body')).toBeTruthy();

      await userEvent.click(screen.getByRole('button', { name: 'Share' }));
      expect(screen.queryByText('popover body')).toBeNull();
    });
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
});
