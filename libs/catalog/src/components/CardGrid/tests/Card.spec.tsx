import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../../../models/catalog-item';
import { CatalogEntityType } from '../../../types/entity-type';
import {
  CredentialStatus,
  ToolsetAuthenticationType,
} from '../../../types/toolset-auth';
import { Card } from '../Card';

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

describe('Card — selected state', () => {
  it('does not show a selected border or checkmark by default', () => {
    render(<Card item={makeItem()} />);

    const card = screen.getByRole('article', { hidden: true });
    expect(card.className).toContain('border-transparent');
    expect(card.className).not.toContain('border-accent-primary');
  });

  it('shows the selected border, tint, and checkmark when isSelected is true', () => {
    render(<Card item={makeItem()} isSelected />);

    const card = screen.getByRole('article', { hidden: true });
    expect(card.className).toContain('border-accent-primary');
    expect(card.className).toContain('bg-accent-primary-alpha');
    expect(card.querySelector('svg')).toBeTruthy();
  });
});

describe('Card — credentials badge', () => {
  it('shows the LOGGED OUT badge for a signed-out toolset, for both API_KEY and OAUTH', () => {
    for (const authenticationType of [
      ToolsetAuthenticationType.ApiKey,
      ToolsetAuthenticationType.OAuth,
    ]) {
      const { unmount } = render(
        <Card
          item={makeItem({
            credentials: {
              authenticationType,
              userStatus: CredentialStatus.SignedOut,
              globalStatus: CredentialStatus.SignedOut,
            },
          })}
          credentialsBadgeLoggedOutLabel="LOGGED OUT"
        />,
      );
      expect(screen.getByText('LOGGED OUT')).toBeTruthy();
      unmount();
    }
  });

  it('shows no badge when signed in or when authenticationType is NONE', () => {
    const { unmount } = render(
      <Card
        item={makeItem({
          credentials: {
            authenticationType: ToolsetAuthenticationType.OAuth,
            userStatus: CredentialStatus.SignedIn,
          },
        })}
        credentialsBadgeLoggedOutLabel="LOGGED OUT"
      />,
    );
    expect(screen.queryByText('LOGGED OUT')).toBeNull();
    unmount();

    render(
      <Card
        item={makeItem({
          credentials: { authenticationType: ToolsetAuthenticationType.None },
        })}
        credentialsBadgeLoggedOutLabel="LOGGED OUT"
      />,
    );
    expect(screen.queryByText('LOGGED OUT')).toBeNull();
  });
});
