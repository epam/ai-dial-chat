import { describe, expect, it } from 'vitest';
import type { CatalogItemCredentials } from '../models/catalog-item-credentials';
import {
  CredentialsBadgeState,
  CredentialStatus,
  CredentialsUiState,
  ToolsetAuthenticationType,
} from '../types/toolset-auth';
import {
  getCredentialsBadgeState,
  getCredentialsUiState,
} from './toolset-credentials';

const base = (
  overrides?: Partial<CatalogItemCredentials>,
): CatalogItemCredentials => ({
  authenticationType: ToolsetAuthenticationType.ApiKey,
  ...overrides,
});

describe('getCredentialsUiState', () => {
  it('returns ManageCredentials when isManageableByAdmin is true', () => {
    expect(getCredentialsUiState(base({ isManageableByAdmin: true }))).toBe(
      CredentialsUiState.ManageCredentials,
    );
  });

  it('returns LoginWithMyCreds for a public item not signed in at USER level', () => {
    expect(
      getCredentialsUiState(
        base({ isPublic: true, globalStatus: CredentialStatus.SignedIn }),
      ),
    ).toBe(CredentialsUiState.LoginWithMyCreds);
  });

  it('returns LogIn when signed out at every level and not public', () => {
    expect(getCredentialsUiState(base())).toBe(CredentialsUiState.LogIn);
  });

  it('returns LogOut when signed in at USER level', () => {
    expect(
      getCredentialsUiState(base({ userStatus: CredentialStatus.SignedIn })),
    ).toBe(CredentialsUiState.LogOut);
  });

  it('returns LogOut when signed in at GLOBAL level (non-public)', () => {
    expect(
      getCredentialsUiState(base({ globalStatus: CredentialStatus.SignedIn })),
    ).toBe(CredentialsUiState.LogOut);
  });
});

describe('getCredentialsBadgeState', () => {
  it('returns undefined for NONE authentication', () => {
    expect(
      getCredentialsBadgeState(
        base({ authenticationType: ToolsetAuthenticationType.None }),
      ),
    ).toBeUndefined();
  });

  it('returns LoggedOut when signed out at every level', () => {
    expect(getCredentialsBadgeState(base())).toBe(
      CredentialsBadgeState.LoggedOut,
    );
  });

  it('returns undefined when signed in at USER level', () => {
    expect(
      getCredentialsBadgeState(base({ userStatus: CredentialStatus.SignedIn })),
    ).toBeUndefined();
  });

  it('returns undefined when signed in at GLOBAL level on a non-public item', () => {
    expect(
      getCredentialsBadgeState(
        base({ globalStatus: CredentialStatus.SignedIn, isPublic: false }),
      ),
    ).toBeUndefined();
  });

  it('returns undefined when signed in at GLOBAL level on a public item', () => {
    expect(
      getCredentialsBadgeState(
        base({ globalStatus: CredentialStatus.SignedIn, isPublic: true }),
      ),
    ).toBeUndefined();
  });

  it('applies the identical LoggedOut rule to API_KEY and OAUTH authentication types', () => {
    expect(
      getCredentialsBadgeState(
        base({ authenticationType: ToolsetAuthenticationType.ApiKey }),
      ),
    ).toBe(CredentialsBadgeState.LoggedOut);
    expect(
      getCredentialsBadgeState(
        base({ authenticationType: ToolsetAuthenticationType.OAuth }),
      ),
    ).toBe(CredentialsBadgeState.LoggedOut);
  });
});
