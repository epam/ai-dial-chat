import { AuthTokens } from "@/src/core/debugAuth";

export class AuthUtils {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static createStorageState(authTokens: AuthTokens, baseUrl: string): any {
    const url = new URL(baseUrl);
    const isSecure = url.protocol === 'https:';
    const expiresInSeconds = Math.floor(
      (Date.now() + 24 * 60 * 60 * 1000) / 1000,
    );

    const cookies = [
      {
        name: 'next-auth.session-token',
        value: authTokens.sessionToken,
        domain: url.hostname,
        path: '/',
        expires: expiresInSeconds,
        httpOnly: true,
        secure: isSecure,
        sameSite: 'Lax' as const,
      },
      {
        name: 'next-auth.csrf-token',
        value: authTokens.csrfToken,
        domain: url.hostname,
        path: '/',
        expires: expiresInSeconds,
        httpOnly: true,
        secure: isSecure,
        sameSite: 'Lax' as const,
      },
    ];

    const localStorage = [
      { name: 'bucket', value: authTokens.bucket },
      ...(authTokens.models
        ? [{ name: 'models', value: authTokens.models }]
        : []),
      ...(authTokens.addons
        ? [{ name: 'addons', value: authTokens.addons }]
        : []),
      ...(authTokens.themes
        ? [{ name: 'themes', value: authTokens.themes }]
        : []),
      ...(authTokens.recentAddons
        ? [{ name: 'recentAddons', value: authTokens.recentAddons }]
        : []),
      ...(authTokens.recentModels
        ? [{ name: 'recentModels', value: authTokens.recentModels }]
        : []),
    ];

    return {
      cookies,
      origins: [{ origin: baseUrl, localStorage }],
    };
  }
}
