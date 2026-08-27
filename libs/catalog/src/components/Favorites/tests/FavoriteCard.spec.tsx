import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../models/catalog-item';
import {
  CredentialStatus,
  ToolsetAuthenticationType,
} from '../../../types/toolset-auth';
import { FavoriteCard } from '../FavoriteCard';

const makeItem = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  id: '1',
  type: CatalogEntityType.Model,
  name: 'Claude',
  version: '1.0',
  description: 'desc',
  topics: [],
  folder: [],
  lastUsed: '',
  ...overrides,
});

describe('FavoriteCard — selected state', () => {
  it('does not show a selected border or checkmark by default', () => {
    render(<FavoriteCard item={makeItem()} />);

    const card = screen.getByLabelText('Claude');
    expect(card.className).toContain('border-transparent');
    expect(card.className).not.toContain('selectedCard');
    // Checkmark icon is aria-hidden with no accessible role, so no semantic query can find it.
    // eslint-disable-next-line testing-library/no-node-access
    expect(card.querySelector('svg[aria-hidden]')).toBeNull();
  });

  it('shows the selected border, tint, and checkmark when isSelected is true', () => {
    render(<FavoriteCard item={makeItem()} isSelected />);

    const card = screen.getByLabelText('Claude');
    expect(card.className).toContain('selectedCard');
    // eslint-disable-next-line testing-library/no-node-access
    expect(card.querySelector('svg[aria-hidden]')).toBeTruthy();
  });
});

describe('FavoriteCard — favorite visibility', () => {
  it('renders the star button by default for a favorited item', () => {
    render(<FavoriteCard item={makeItem()} />);

    expect(
      screen.getByRole('button', { name: 'Remove from favorites' }),
    ).toBeTruthy();
  });

  it('hides the star button and keeps the item non-favoritable when isFavoriteVisible returns false', () => {
    render(
      <FavoriteCard
        item={makeItem()}
        isFavoriteVisible={() => false}
        onToggle={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Remove from favorites' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Add to favorites' }),
    ).toBeNull();
  });

  it('renders the star button when isFavoriteVisible returns true', () => {
    render(<FavoriteCard item={makeItem()} isFavoriteVisible={() => true} />);

    expect(
      screen.getByRole('button', { name: 'Remove from favorites' }),
    ).toBeTruthy();
  });
});

describe('FavoriteCard — credentials badge', () => {
  it('shows the logged-out warning icon for a signed-out API_KEY toolset', () => {
    render(
      <FavoriteCard
        item={makeItem({
          credentials: {
            authenticationType: ToolsetAuthenticationType.ApiKey,
            userStatus: CredentialStatus.SignedOut,
            globalStatus: CredentialStatus.SignedOut,
          },
        })}
        credentialsBadgeLoggedOutLabel="Authorize to use this toolset."
      />,
    );

    expect(
      screen.getByRole('img', { name: 'Authorize to use this toolset.' }),
    ).toBeTruthy();
  });

  it('shows the logged-out warning icon for a signed-out OAUTH toolset', () => {
    render(
      <FavoriteCard
        item={makeItem({
          credentials: {
            authenticationType: ToolsetAuthenticationType.OAuth,
            userStatus: CredentialStatus.SignedOut,
            globalStatus: CredentialStatus.SignedOut,
          },
        })}
        credentialsBadgeLoggedOutLabel="Authorize to use this toolset."
      />,
    );

    expect(
      screen.getByRole('img', { name: 'Authorize to use this toolset.' }),
    ).toBeTruthy();
  });

  it('shows no warning icon when signed in', () => {
    render(
      <FavoriteCard
        item={makeItem({
          credentials: {
            authenticationType: ToolsetAuthenticationType.OAuth,
            userStatus: CredentialStatus.SignedIn,
            globalStatus: CredentialStatus.SignedOut,
          },
        })}
        credentialsBadgeLoggedOutLabel="Authorize to use this toolset."
      />,
    );

    expect(
      screen.queryByRole('img', { name: 'Authorize to use this toolset.' }),
    ).toBeNull();
  });

  it('shows no warning icon for authenticationType NONE', () => {
    render(
      <FavoriteCard
        item={makeItem({
          credentials: {
            authenticationType: ToolsetAuthenticationType.None,
          },
        })}
        credentialsBadgeLoggedOutLabel="Authorize to use this toolset."
      />,
    );

    expect(
      screen.queryByRole('img', { name: 'Authorize to use this toolset.' }),
    ).toBeNull();
  });
});
