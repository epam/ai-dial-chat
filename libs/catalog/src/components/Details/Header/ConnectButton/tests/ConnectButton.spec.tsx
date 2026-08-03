import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../../../models/catalog-item';
import { CatalogEntityType } from '../../../../../types/entity-type';
import { ConnectButton } from '../ConnectButton';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  NeutralButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => <button onClick={onClick}>{label}</button>,
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
  IconPlugConnected: () => <svg />,
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

describe('ConnectButton', () => {
  it('does not render when isConnectVisible is absent', () => {
    render(
      <ConnectButton
        item={makeItem(CatalogEntityType.Toolset)}
        connectOverlay={() => <div>overlay</div>}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
  });

  it('does not render when isConnectVisible returns false', () => {
    render(
      <ConnectButton
        item={makeItem(CatalogEntityType.Toolset)}
        connectOverlay={() => <div>overlay</div>}
        isConnectVisible={() => false}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
  });

  it('does not render when connectOverlay is absent even if isConnectVisible returns true', () => {
    render(
      <ConnectButton
        item={makeItem(CatalogEntityType.Toolset)}
        isConnectVisible={() => true}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
  });

  it('renders Connect when visible and an overlay is supplied', () => {
    render(
      <ConnectButton
        item={makeItem(CatalogEntityType.Toolset)}
        connectOverlay={() => <div>overlay</div>}
        isConnectVisible={() => true}
      />,
    );
    expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy();
  });

  it('defaults its label to Connect', () => {
    render(
      <ConnectButton
        item={makeItem(CatalogEntityType.Toolset)}
        connectOverlay={() => <div>overlay</div>}
        isConnectVisible={() => true}
      />,
    );
    expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy();
  });

  it('uses the provided label', () => {
    render(
      <ConnectButton
        item={makeItem(CatalogEntityType.Toolset)}
        connectOverlay={() => <div>overlay</div>}
        isConnectVisible={() => true}
        label="Connect this"
      />,
    );
    expect(screen.getByRole('button', { name: 'Connect this' })).toBeTruthy();
  });

  it('opens the popover and calls connectOverlay with the item and a working onClose', async () => {
    const item = makeItem(CatalogEntityType.Toolset);
    const connectOverlay = vi.fn((_item: CatalogItem, onClose: () => void) => (
      <button onClick={onClose}>close popover</button>
    ));
    render(
      <ConnectButton
        item={item}
        connectOverlay={connectOverlay}
        isConnectVisible={() => true}
      />,
    );

    expect(screen.queryByRole('button', { name: 'close popover' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

    expect(connectOverlay).toHaveBeenCalledWith(item, expect.any(Function));
    expect(screen.getByRole('button', { name: 'close popover' })).toBeTruthy();
  });

  it('closes the popover when the overlay calls its onClose callback', async () => {
    const connectOverlay = (_item: CatalogItem, onClose: () => void) => (
      <button onClick={onClose}>close popover</button>
    );
    render(
      <ConnectButton
        item={makeItem(CatalogEntityType.Toolset)}
        connectOverlay={connectOverlay}
        isConnectVisible={() => true}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'close popover' }),
    );

    expect(screen.queryByRole('button', { name: 'close popover' })).toBeNull();
  });

  it('toggles the popover closed when Connect is clicked again', async () => {
    const connectOverlay = () => <div>popover body</div>;
    render(
      <ConnectButton
        item={makeItem(CatalogEntityType.Toolset)}
        connectOverlay={connectOverlay}
        isConnectVisible={() => true}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(screen.getByText('popover body')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(screen.queryByText('popover body')).toBeNull();
  });
});
