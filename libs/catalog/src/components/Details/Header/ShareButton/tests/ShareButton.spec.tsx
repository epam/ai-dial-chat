import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../../../models/catalog-item';
import { ShareButton } from '../ShareButton';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  NeutralButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => <button onClick={onClick}>{label}</button>,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  Dropdown: ({
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

  it('hides Share for an item not owned by the current user', () => {
    render(
      <ShareButton
        item={{ ...makeItem(CatalogEntityType.Agent), isMyApp: false }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('hides Share when isMyApp is not set', () => {
    const item = makeItem(CatalogEntityType.Agent);
    delete item.isMyApp;
    render(<ShareButton item={item} />);
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('hides Share when isShareVisible returns false, even though the built-in rule allows it', () => {
    render(
      <ShareButton
        item={makeItem(CatalogEntityType.Toolset)}
        isShareVisible={() => false}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('shows Share when isShareVisible returns true and the built-in rule allows it', () => {
    render(
      <ShareButton
        item={makeItem(CatalogEntityType.Toolset)}
        isShareVisible={() => true}
      />,
    );
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
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
});
