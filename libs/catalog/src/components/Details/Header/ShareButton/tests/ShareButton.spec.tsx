import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../../../models/catalog-item';
import { CatalogEntityType } from '../../../../../types/entity-type';
import { ShareButton } from '../ShareButton';

vi.mock('@epam/ai-dial-kit', () => ({
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
  IconShare: () => <svg />,
  IconTrash: () => <svg />,
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

describe('ShareButton', () => {
  it('renders Share for a Toolset item', () => {
    render(<ShareButton item={makeItem(CatalogEntityType.Toolset)} />);
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
  });

  it('hides Share for a Guardrail item', () => {
    render(<ShareButton item={makeItem(CatalogEntityType.Guardrail)} />);
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('hides Share for an MCP item', () => {
    render(<ShareButton item={makeItem(CatalogEntityType.Mcp)} />);
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('hides Share for an item not owned by the current user', () => {
    render(
      <ShareButton
        item={{ ...makeItem(CatalogEntityType.Application), isMyApp: false }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('hides Share when isMyApp is not set', () => {
    const item = makeItem(CatalogEntityType.Application);
    delete item.isMyApp;
    render(<ShareButton item={item} />);
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('uses the provided label', () => {
    render(
      <ShareButton
        item={makeItem(CatalogEntityType.Model)}
        label="Share this"
      />,
    );
    expect(screen.getByRole('button', { name: 'Share this' })).toBeTruthy();
  });

  it('calls onShare with the item when clicked', async () => {
    const onShare = vi.fn();
    const item = makeItem(CatalogEntityType.Model);
    render(<ShareButton item={item} onShare={onShare} />);
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
        <ShareButton
          item={item}
          onShare={onShare}
          shareOverlay={shareOverlay}
        />,
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
        <ShareButton
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
        <ShareButton
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

  describe('recipient-side Delete', () => {
    const makeSharedItem = (type: CatalogEntityType): CatalogItem => ({
      ...makeItem(type),
      isMyApp: false,
      sharedWithMe: true,
    });

    it('renders Delete instead of Share for a shared-with-me item', () => {
      render(
        <ShareButton item={makeSharedItem(CatalogEntityType.Application)} />,
      );
      expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    });

    it('renders neither Share nor Delete for a public/organization item', () => {
      const item: CatalogItem = {
        ...makeItem(CatalogEntityType.Application),
        isMyApp: false,
        sharedWithMe: false,
      };
      render(<ShareButton item={item} />);
      expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    });

    it('renders Delete for a READ-only shared item (isEditable false)', () => {
      const item: CatalogItem = {
        ...makeSharedItem(CatalogEntityType.Toolset),
        isEditable: false,
      };
      render(<ShareButton item={item} />);
      expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    });

    it('renders Delete for a WRITE-shared item (isEditable true)', () => {
      const item: CatalogItem = {
        ...makeSharedItem(CatalogEntityType.Toolset),
        isEditable: true,
      };
      render(<ShareButton item={item} />);
      expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    });

    it('hides Delete for a Guardrail item', () => {
      render(
        <ShareButton item={makeSharedItem(CatalogEntityType.Guardrail)} />,
      );
      expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    });

    it('hides Delete for an MCP item', () => {
      render(<ShareButton item={makeSharedItem(CatalogEntityType.Mcp)} />);
      expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    });

    it('uses the provided unshareLabel', () => {
      render(
        <ShareButton
          item={makeSharedItem(CatalogEntityType.Application)}
          unshareLabel="Stop sharing"
        />,
      );
      expect(screen.getByRole('button', { name: 'Stop sharing' })).toBeTruthy();
    });

    it('calls onUnshare with the item when clicked', async () => {
      const onUnshare = vi.fn();
      const item = makeSharedItem(CatalogEntityType.Application);
      render(<ShareButton item={item} onUnshare={onUnshare} />);
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(onUnshare).toHaveBeenCalledWith(item);
    });
  });
});
