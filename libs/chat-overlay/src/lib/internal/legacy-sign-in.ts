import { type ChatOverlayOptions, OverlayAuthUiMode } from '../../protocol';

/**
 * Returns the effective `auth` options, folding the deprecated
 * `signInOptions.autoSignIn` + `signInProvider` pair into
 * `autoSignInProvider` and a `providerUiModes` entry. Explicit `auth` values
 * always win over the legacy ones.
 */
export const resolveOverlayAuth = (
  options: ChatOverlayOptions,
): ChatOverlayOptions['auth'] => {
  const { auth, signInOptions } = options;
  const legacyProvider = signInOptions?.signInProvider?.trim();
  if (
    signInOptions?.autoSignIn !== true ||
    !legacyProvider ||
    auth?.autoSignInProvider?.trim()
  ) {
    return auth;
  }

  /*
   * The legacy chat navigated the iframe itself unless `signInInNewWindow`
   * was set, so that is the mode the provider is mapped to. A mode the host
   * already set for this provider is kept.
   */
  const legacyMode = signInOptions.signInInNewWindow
    ? OverlayAuthUiMode.External
    : OverlayAuthUiMode.SameWindow;
  return {
    ...auth,
    providerUiModes: {
      [legacyProvider]: legacyMode,
      ...auth?.providerUiModes,
    },
    autoSignInProvider: legacyProvider,
  };
};
