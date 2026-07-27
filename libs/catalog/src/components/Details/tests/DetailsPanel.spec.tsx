import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../models/catalog-item';
import { PublishFolderNode } from '../../../models/publish';
import { CatalogEntityType } from '../../../types/entity-type';
import { DetailsPanel } from '../DetailsPanel';

vi.mock('@epam/ai-dial-kit', () => ({
  TabRow: ({
    tabs,
    onTabChange,
  }: {
    tabs: { id: string; label: string }[];
    onTabChange?: (id: string) => void;
  }) => (
    <div role="tablist">
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => onTabChange?.(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  ),
  GhostIconButton: ({
    'aria-label': ariaLabel,
    onClick,
    disabled,
  }: {
    'aria-label': string;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button disabled={disabled} onClick={onClick}>
      {ariaLabel}
    </button>
  ),
}));
vi.mock('@epam/ai-dial-ui-kit', () => ({
  DialCloseButton: ({
    onClose,
    ariaLabel,
  }: {
    onClose: () => void;
    ariaLabel: string;
  }) => <button onClick={onClose}>{ariaLabel}</button>,
  DialSkeleton: () => <div>skeleton</div>,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  DialConfirmationPopup: ({
    open,
    header,
    description,
    confirmLabel,
    cancelLabel,
    isLoading,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    header?: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isLoading?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
  }) =>
    open ? (
      <div role="dialog">
        <span>{header}</span>
        <span>{description}</span>
        <button disabled={isLoading} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button onClick={onCancel}>{cancelLabel}</button>
      </div>
    ) : null,
  DialAccordion: ({
    title,
    children,
  }: {
    title: string;
    children?: React.ReactNode;
  }) => (
    <section>
      <span>{title}</span>
      {children}
    </section>
  ),
}));
vi.mock('@tabler/icons-react', () => ({
  IconChevronLeft: () => <svg />,
  IconChevronDown: () => <svg />,
  IconKey: () => <svg />,
  IconLogin: () => <svg />,
  IconLogout: () => <svg />,
  IconPencil: () => <svg />,
  IconPlayerPlayFilled: () => <svg />,
  IconShare: () => <svg />,
}));
vi.mock('../../EntityHeader/EntityHeader', () => ({
  EntityHeader: ({ item }: { item: CatalogItem }) => <div>{item.name}</div>,
}));
vi.mock('../../StarToggleButton/StarToggleButton', () => ({
  StarToggleButton: () => <div>Star</div>,
}));
vi.mock('../Header/Header', () => ({
  Header: ({ onOpenPublish }: { onOpenPublish?: () => void }) => (
    <button onClick={onOpenPublish}>Publish</button>
  ),
}));
vi.mock('../Summary/Summary', () => ({ Summary: () => <div>Summary</div> }));
vi.mock('../TabsContent/About', () => ({
  AboutTab: () => <div>about content</div>,
}));
vi.mock('../TabsContent/Overview', () => ({
  Overview: () => <div>Overview</div>,
}));
vi.mock('../TabsContent/Pricing', () => ({
  Pricing: () => <div>Pricing</div>,
}));
vi.mock('../TabsContent/Limits', () => ({
  LimitsTab: () => <div>Limits content</div>,
}));
vi.mock('../TabsContent/Tools/Tools', () => ({
  Tools: () => <div>Tools</div>,
}));
vi.mock('../ApiDetails', () => ({ ApiDetails: () => <div>Api</div> }));
vi.mock('../../PublishPanel/PublishPanel', () => ({
  PublishPanel: ({
    onSelectedFolderPathChange,
    onCreateFolder,
  }: {
    onSelectedFolderPathChange: (path: string[]) => void;
    onCreateFolder: (parentPath: string[], name: string) => Promise<void>;
  }) => (
    <div>
      <span>Publish panel</span>
      <button onClick={() => onSelectedFolderPathChange(['Shared'])}>
        Select Shared
      </button>
      <button onClick={() => void onCreateFolder(['Shared'], 'New')}>
        Create folder
      </button>
    </div>
  ),
}));
vi.mock('../../PublishPanel/PublishFooter', () => ({
  PublishFooter: ({
    onCancel,
    onSubmit,
  }: {
    onCancel: () => void;
    onSubmit: () => void;
  }) => (
    <div>
      <button onClick={onCancel}>Cancel</button>
      <button onClick={onSubmit}>Submit</button>
    </div>
  ),
}));

const item: CatalogItem = {
  id: '1',
  type: CatalogEntityType.Model,
  name: 'GPT-4o',
  version: '1.0',
  lastUsed: 'now',
  description: '',
  folder: [],
  topics: [],
};

const folderItems: PublishFolderNode[] = [{ path: ['Shared'], name: 'Shared' }];

const makeItem = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  id: '1',
  type: CatalogEntityType.Model,
  name: 'Claude',
  version: '1',
  lastUsed: 'now',
  description: '',
  folder: [],
  topics: [],
  ...overrides,
});

const renderPanel = (props?: Partial<ComponentProps<typeof DetailsPanel>>) =>
  render(
    <DetailsPanel
      item={item}
      isOpen
      onClose={vi.fn()}
      publishFolderItems={folderItems}
      onPublish={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />,
  );

describe('DetailsPanel', () => {
  it('renders the details content by default', () => {
    renderPanel();
    expect(screen.getByText('Summary')).toBeTruthy();
    expect(screen.queryByText('Publish panel')).toBeNull();
  });

  it('shows the Star toggle and hides the back button by default', () => {
    renderPanel();
    expect(screen.getByText('Star')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('shows the Limits tab when limits data is available', async () => {
    renderPanel({
      item: makeItem({
        details: {
          limits: {
            rows: [{ label: 'Tokens per day', used: 12, total: 20 }],
          },
        },
      }),
    });

    await userEvent.click(screen.getByRole('button', { name: 'Limits' }));

    expect(screen.getByText('Limits content')).toBeTruthy();
  });

  it('replaces the details content with the publish panel when Publish is clicked', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(screen.getByText('Publish panel')).toBeTruthy();
    expect(screen.queryByText('Summary')).toBeNull();
  });

  it('shows the back button and hides Star while publishing', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(screen.queryByText('Star')).toBeNull();
  });

  it('shows the Close button by default', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('hides the Close button while publishing', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('returns to the details content when the back button is clicked', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Summary')).toBeTruthy();
    expect(screen.queryByText('Publish panel')).toBeNull();
  });

  it('returns to the details content when Cancel is clicked in the publish panel', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Summary')).toBeTruthy();
  });

  it('creates publish folders through the shared publish flow', async () => {
    const onCreatePublishFolder = vi.fn().mockResolvedValue(undefined);
    renderPanel({ onCreatePublishFolder });

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Create folder' }),
    );

    expect(onCreatePublishFolder).toHaveBeenCalledWith(['Shared'], 'New');
  });

  it('calls onPublish and onPublishSuccess for the selected folder when the publish panel submits', async () => {
    const onPublish = vi.fn().mockResolvedValue(undefined);
    const onPublishSuccess = vi.fn();
    renderPanel({ onPublish, onPublishSuccess });
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onPublish).toHaveBeenCalledWith(item, ['Shared']);
    expect(onPublishSuccess).toHaveBeenCalledWith(item, ['Shared']);
  });

  it('returns to the details content after a successful publish submit', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByText('Summary')).toBeTruthy();
    expect(screen.queryByText('Publish panel')).toBeNull();
  });

  it('stays on the publish panel when the publish submit fails', async () => {
    const onPublish = vi.fn().mockRejectedValue(new Error('network error'));
    const onPublishSuccess = vi.fn();
    renderPanel({ onPublish, onPublishSuccess });
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByText('Publish panel')).toBeTruthy();
    expect(screen.queryByText('Summary')).toBeNull();
    expect(onPublishSuccess).not.toHaveBeenCalled();
  });

  it('disables the Back button while a publish request is in flight', async () => {
    let resolvePublish: () => void = () => undefined;
    const onPublish = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePublish = resolve;
        }),
    );
    renderPanel({ onPublish });
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(
      screen.getByRole('button', { name: 'Back' }).hasAttribute('disabled'),
    ).toBe(true);
    await act(async () => {
      resolvePublish();
      await Promise.resolve();
    });
  });

  it('shows a loading placeholder next to the tab row when isDetailsLoading is true', () => {
    render(
      <DetailsPanel
        item={makeItem()}
        isOpen
        isDetailsLoading
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('status', { name: 'Loading details' }),
    ).toBeTruthy();
  });

  it('does not show a loading placeholder when isDetailsLoading is false', () => {
    render(
      <DetailsPanel
        item={makeItem()}
        isOpen
        isDetailsLoading={false}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('status', { name: 'Loading details' }),
    ).toBeNull();
  });

  it('uses a custom detailsLoadingAriaLabel', () => {
    render(
      <DetailsPanel
        item={makeItem()}
        isOpen
        isDetailsLoading
        onClose={vi.fn()}
        texts={{ detailsLoadingAriaLabel: 'Fetching details' }}
      />,
    );
    expect(
      screen.getByRole('status', { name: 'Fetching details' }),
    ).toBeTruthy();
  });

  it('renders the description inline in the intro section', () => {
    render(
      <DetailsPanel
        item={makeItem({
          details: { overview: { sections: [] } },
        })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(screen.getAllByText('about content').length).toBeGreaterThan(0);
  });

  it('includes About as the first tab, ahead of the other available tabs', () => {
    render(
      <DetailsPanel
        item={makeItem({
          details: { overview: { sections: [] } },
        })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    const tablist = screen.getByRole('tablist');
    expect(tablist.textContent).toBe('AboutOverview');
  });

  it('always includes the About tab even when no other tabs are available', () => {
    render(<DetailsPanel item={makeItem()} isOpen onClose={vi.fn()} />);

    const tablist = screen.getByRole('tablist');
    expect(tablist.textContent).toBe('About');
  });
});
