import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../../../models/catalog-item';
import { CatalogEntityType } from '../../../types/entity-type';
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
    expect(card.className).not.toContain('border-info');
    expect(card.querySelector('svg[aria-hidden]')).toBeNull();
  });

  it('shows the selected border, tint, and checkmark when isSelected is true', () => {
    render(<FavoriteCard item={makeItem()} isSelected />);

    const card = screen.getByLabelText('Claude');
    expect(card.className).toContain('border-info');
    expect(card.className).toContain('bg-accent-primary-alpha');
    expect(card.querySelector('svg[aria-hidden]')).toBeTruthy();
  });
});

describe('FavoriteCard — credentials badge', () => {
  it('shows the LOGGED OUT badge for a signed-out API_KEY toolset', () => {
    render(
      <FavoriteCard
        item={makeItem({
          credentials: {
            authenticationType: ToolsetAuthenticationType.ApiKey,
            userStatus: CredentialStatus.SignedOut,
            globalStatus: CredentialStatus.SignedOut,
          },
        })}
        credentialsBadgeLoggedOutLabel="LOGGED OUT"
      />,
    );

    expect(screen.getByText('LOGGED OUT')).toBeTruthy();
  });

  it('shows the LOGGED OUT badge for a signed-out OAUTH toolset', () => {
    render(
      <FavoriteCard
        item={makeItem({
          credentials: {
            authenticationType: ToolsetAuthenticationType.OAuth,
            userStatus: CredentialStatus.SignedOut,
            globalStatus: CredentialStatus.SignedOut,
          },
        })}
        credentialsBadgeLoggedOutLabel="LOGGED OUT"
      />,
    );

    expect(screen.getByText('LOGGED OUT')).toBeTruthy();
  });

  it('shows no badge when signed in', () => {
    render(
      <FavoriteCard
        item={makeItem({
          credentials: {
            authenticationType: ToolsetAuthenticationType.OAuth,
            userStatus: CredentialStatus.SignedIn,
            globalStatus: CredentialStatus.SignedOut,
          },
        })}
        credentialsBadgeLoggedOutLabel="LOGGED OUT"
      />,
    );

    expect(screen.queryByText('LOGGED OUT')).toBeNull();
  });

  it('shows no badge for authenticationType NONE', () => {
    render(
      <FavoriteCard
        item={makeItem({
          credentials: {
            authenticationType: ToolsetAuthenticationType.None,
          },
        })}
        credentialsBadgeLoggedOutLabel="LOGGED OUT"
      />,
    );

    expect(screen.queryByText('LOGGED OUT')).toBeNull();
  });
});
