import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../models/catalog-item';
import { CatalogEntityType } from '../../../types/entity-type';
import { DetailsPanel } from '../DetailsPanel';

vi.mock('@epam/ai-dial-kit', () => ({
  TabRow: ({ tabs }: { tabs: { id: string; label: React.ReactNode }[] }) => (
    <div role="tablist">
      {tabs.map((tab) => (
        <span key={tab.id}>{tab.label}</span>
      ))}
    </div>
  ),
  PrimaryButton: ({ label }: { label: string }) => <button>{label}</button>,
  NeutralButton: ({ label }: { label: string }) => <button>{label}</button>,
}));
vi.mock('@epam/ai-dial-ui-kit', () => ({
  DialCloseButton: ({ ariaLabel }: { ariaLabel?: string }) => (
    <button aria-label={ariaLabel}>close</button>
  ),
  DialSkeleton: () => <div>skeleton</div>,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  DialConfirmationPopup: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" /> : null,
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
vi.mock('../../FolderPath/FolderPath', () => ({
  FolderPath: () => <div />,
}));
vi.mock('../../StarToggleButton/StarToggleButton', () => ({
  StarToggleButton: () => <button>star</button>,
}));
vi.mock('../../TopicTag/TopicTag', () => ({
  TopicTag: () => <span />,
}));
vi.mock('../Summary/Limits', () => ({
  Limits: () => <div />,
}));
vi.mock('../TabsContent/About', () => ({
  AboutTab: () => <div>about content</div>,
}));

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

describe('DetailsPanel', () => {
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
