import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CatalogEntityType } from '../../../types/CatalogEntityType';
import { CatalogCard } from '../CatalogCard';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DialGhostIconButton: ({
    icon,
    onClick,
  }: {
    icon: React.ReactNode;
    onClick: () => void;
  }) => <button onClick={onClick}>{icon}</button>,
}));
vi.mock('@tabler/icons-react', () => ({
  IconStar: () => <svg data-testid="star" />,
  IconStarFilled: () => <svg data-testid="star-filled" />,
}));
vi.mock('../../EntityTypeBadge/EntityTypeBadge', () => ({
  EntityTypeBadge: ({ type }: { type: string }) => <span>{type}</span>,
}));
vi.mock('../../FeaturedTag/FeaturedTag', () => ({
  FeaturedTag: () => <span>Featured</span>,
}));
vi.mock('../../FolderPath/FolderPath', () => ({
  FolderPath: ({ segments }: { segments: string[] }) => (
    <span>{segments.join(' / ')}</span>
  ),
}));
vi.mock('../../Highlight/Highlight', () => ({
  Highlight: ({ text }: { text: string }) => <span>{text}</span>,
}));
vi.mock('../../PricingTag/PricingTag', () => ({
  PricingTag: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock('../../ProviderLogo/ProviderLogo', () => ({
  ProviderLogo: ({ initial }: { initial: string }) => <span>{initial}</span>,
}));

const item = {
  id: 'c1',
  type: CatalogEntityType.Model,
  name: 'Claude Opus',
  version: 'Opus 4.7',
  description: 'Embedding model for semantic search.',
  pricing: ['Free'],
  isFeatured: true,
  folder: ['EPAM', 'Research'],
  logoInitial: 'A',
  lastUsed: '',
  from: 'dial',
  domain: 'Engineering',
  useCase: 'Code generation',
  maturity: 'Production',
};

describe('CatalogCard', () => {
  it('renders name and description', () => {
    render(<CatalogCard item={item} />);
    expect(screen.getByText('Claude Opus')).toBeTruthy();
    expect(
      screen.getByText('Embedding model for semantic search.'),
    ).toBeTruthy();
  });

  it('renders pricing tags', () => {
    render(<CatalogCard item={item} />);
    expect(screen.getByText('Free')).toBeTruthy();
  });

  it('renders featured tag when isFeatured', () => {
    render(<CatalogCard item={item} />);
    expect(screen.getByText('Featured')).toBeTruthy();
  });

  it('calls onToggle when star is clicked', async () => {
    const onToggle = vi.fn();
    render(
      <CatalogCard item={item} initialIsStarred={false} onToggle={onToggle} />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledWith('c1', true);
  });
});
