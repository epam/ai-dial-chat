import { describe, expect, it } from 'vitest';
import type { CatalogItemCredentials } from '../models/catalog-item-credentials';
import {
  CredentialsBadgeState,
  CredentialsBannerState,
  CredentialStatus,
  CredentialsUiState,
  ToolsetAuthenticationType,
} from '../types/toolset-auth';
import {
  getCredentialsBadgeState,
  getCredentialsBannerState,
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

describe('getCredentialsBannerState', () => {
  it('returns undefined when organization credentials are not signed in', () => {
    expect(getCredentialsBannerState(base())).toBeUndefined();
  });

  it('returns UsingOrgCredentials for a non-admin, personally signed-out user on a public item with active org credentials', () => {
    expect(
      getCredentialsBannerState(
        base({ isPublic: true, globalStatus: CredentialStatus.SignedIn }),
      ),
    ).toBe(CredentialsBannerState.UsingOrgCredentials);
  });

  it('returns undefined for a public item with active org credentials once the user is also signed in personally', () => {
    expect(
      getCredentialsBannerState(
        base({
          isPublic: true,
          globalStatus: CredentialStatus.SignedIn,
          userStatus: CredentialStatus.SignedIn,
        }),
      ),
    ).toBeUndefined();
  });

  it('returns undefined for a non-public item with active org credentials (no fallback context)', () => {
    expect(
      getCredentialsBannerState(
        base({ isPublic: false, globalStatus: CredentialStatus.SignedIn }),
      ),
    ).toBeUndefined();
  });

  it('returns OrgCredentialsActive for an admin managing a public item with active org credentials', () => {
    expect(
      getCredentialsBannerState(
        base({
          isManageableByAdmin: true,
          globalStatus: CredentialStatus.SignedIn,
        }),
      ),
    ).toBe(CredentialsBannerState.OrgCredentialsActive);
  });

  it('prefers OrgCredentialsActive over UsingOrgCredentials when the admin flag is set', () => {
    expect(
      getCredentialsBannerState(
        base({
          isManageableByAdmin: true,
          isPublic: true,
          globalStatus: CredentialStatus.SignedIn,
        }),
      ),
    ).toBe(CredentialsBannerState.OrgCredentialsActive);
  });

  it('returns PersonalCredentialsActive for an admin managing an item with personal credentials signed in', () => {
    expect(
      getCredentialsBannerState(
        base({
          isManageableByAdmin: true,
          userStatus: CredentialStatus.SignedIn,
        }),
      ),
    ).toBe(CredentialsBannerState.PersonalCredentialsActive);
  });

  it('prefers PersonalCredentialsActive over OrgCredentialsActive when an admin has both signed in', () => {
    expect(
      getCredentialsBannerState(
        base({
          isManageableByAdmin: true,
          userStatus: CredentialStatus.SignedIn,
          globalStatus: CredentialStatus.SignedIn,
        }),
      ),
    ).toBe(CredentialsBannerState.PersonalCredentialsActive);
  });

  it('returns undefined for an admin managing an item signed out at every level', () => {
    expect(
      getCredentialsBannerState(base({ isManageableByAdmin: true })),
    ).toBeUndefined();
  });
});
