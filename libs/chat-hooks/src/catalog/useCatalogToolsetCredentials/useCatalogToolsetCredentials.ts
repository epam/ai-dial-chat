import type { CatalogItem } from '@epam/ai-dial-catalog';
import {
  CredentialsLevel,
  CredentialStatus,
  ToolsetAuthenticationType,
} from '@epam/ai-dial-catalog';
import type {
  DialToolsetDto,
  ToolsetLoginBodyDto,
  ToolsetLogoutBodyDto,
} from '@epam/ai-dial-chat-api-client';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { useCallback } from 'react';
import { getApiErrorDetails } from '../../api-error/api-error';
import { ToolsetAuthTypes, ToolsetCredentialsLevel } from '../../oauth/types';
import {
  ToolsetLoginOutcomeType,
  useToolsetLogin,
} from '../../oauth/useToolsetLogin/useToolsetLogin';

/** A host notification `useCatalogToolsetCredentials` asks to be shown. */
export interface ToolsetCredentialsNotification {
  variant: NotificationVariant;
  title?: string;
  message: string;
  requestId?: string;
}

/** Formats one credentials-level outcome's notification body. */
export interface ToolsetCredentialsMessageLabels {
  user: (params: { name: string; version?: string }) => string;
  org: (params: { name: string; version?: string }) => string;
  global: (params: { name: string; version?: string }) => string;
}

/** Localized copy `useCatalogToolsetCredentials` needs for every outcome it can notify. */
export interface ToolsetCredentialsLabels {
  loginSuccessTitle: string;
  loginSuccess: ToolsetCredentialsMessageLabels;
  apiKeyAddedSuccessTitle: string;
  apiKeyAddedSuccess: ToolsetCredentialsMessageLabels;
  logoutSuccessTitle: string;
  logoutSuccess: ToolsetCredentialsMessageLabels;
  apiKeyDeletedSuccessTitle: string;
  apiKeyDeletedSuccess: ToolsetCredentialsMessageLabels;
  popupBlockedError: string;
  loginFailedError: string;
  logoutFailedError: string;
}

/** Parameters accepted by {@link useCatalogToolsetCredentials}. */
export interface UseCatalogToolsetCredentialsParams {
  isAdmin: boolean;
  toolsets: DialToolsetDto[];
  refetchToolsets: () => Promise<void>;
  /** Route the OAuth popup redirects back to once the provider completes. */
  callbackPath: string;
  /** Already-configured DIAL Core operation: submits credentials for one toolset. */
  loginToolset: (
    toolsetId: string,
    body: ToolsetLoginBodyDto,
  ) => Promise<unknown>;
  /** Already-configured DIAL Core operation: clears credentials for one toolset. */
  logoutToolset: (
    toolsetId: string,
    body: ToolsetLogoutBodyDto,
  ) => Promise<unknown>;
  /** Already-configured DIAL Core operation: re-reads one toolset. */
  getToolset: (toolsetId: string) => Promise<DialToolsetDto>;
  /** Localized notification copy, resolved by the host. */
  labels: ToolsetCredentialsLabels;
  /** Called to surface a host notification. */
  onNotify: (notification: ToolsetCredentialsNotification) => void;
}

/** Return value of {@link useCatalogToolsetCredentials}. */
export interface UseCatalogToolsetCredentialsResult {
  handleLogin: (
    item: CatalogItem,
    params: { level: CredentialsLevel; apiKey?: string },
  ) => Promise<void>;
  handleLogout: (
    item: CatalogItem,
    params: { level: CredentialsLevel },
  ) => Promise<void>;
}

/**
 * Picks the notification-message formatter for a credentials level / org-fallback
 * combination — the user-level formatter always wins, then the org formatter
 * while an admin is acting on a public credential, and the global formatter
 * otherwise.
 */
const pickCredentialsMessage = (
  level: CredentialsLevel,
  isAdminAndPublic: boolean,
  labels: ToolsetCredentialsMessageLabels,
): ToolsetCredentialsMessageLabels['user'] => {
  if (level === CredentialsLevel.User) return labels.user;
  if (isAdminAndPublic) return labels.org;
  return labels.global;
};

/**
 * Maps the catalog's own `ToolsetAuthenticationType` to the OAuth-flow lib's
 * `ToolsetAuthTypes` — nominally distinct string enums with identical values
 * (see `oauth/types.ts`'s own note on why it can't just import this one). A
 * missing `authenticationType` (no credentials configured yet) maps to
 * `None`, matching `ToolsetAuthTypes.None`'s own meaning; the receiving flow
 * only ever branches on `=== OAuth`, so this is behavior-neutral either way.
 */
const toToolsetAuthType = (
  value: ToolsetAuthenticationType | undefined,
): ToolsetAuthTypes => {
  switch (value) {
    case ToolsetAuthenticationType.ApiKey:
      return ToolsetAuthTypes.ApiKey;
    case ToolsetAuthenticationType.OAuth:
      return ToolsetAuthTypes.OAuth;
    case ToolsetAuthenticationType.None:
    case undefined:
      return ToolsetAuthTypes.None;
  }
};

/**
 * Owns the catalog's toolset credential login/logout flow: wires the shared
 * OAuth/API-key login orchestration (`useToolsetLogin`) to this host's DIAL
 * Core operations, resolves each outcome to a notification and toolset
 * refetch, and owns the notification copy for every credential level /
 * API-key / org-fallback combination.
 */
export const useCatalogToolsetCredentials = ({
  isAdmin,
  toolsets,
  refetchToolsets,
  callbackPath,
  loginToolset,
  logoutToolset,
  getToolset,
  labels,
  onNotify,
}: UseCatalogToolsetCredentialsParams): UseCatalogToolsetCredentialsResult => {
  const getLevelStatus = useCallback(
    (
      item: CatalogItem,
      level: CredentialsLevel,
    ): CredentialStatus | undefined =>
      level === CredentialsLevel.User
        ? item.credentials?.userStatus
        : item.credentials?.globalStatus,
    [],
  );

  const showLoginSuccess = useCallback(
    (item: CatalogItem, level: CredentialsLevel) => {
      const isAdminAndPublic = isAdmin && !!item.credentials?.isPublic;
      const isApiKey =
        item.credentials?.authenticationType ===
        ToolsetAuthenticationType.ApiKey;
      if (isApiKey) {
        const formatMessage = pickCredentialsMessage(
          level,
          isAdminAndPublic,
          labels.apiKeyAddedSuccess,
        );
        onNotify({
          variant: NotificationVariant.Success,
          title: labels.apiKeyAddedSuccessTitle,
          message: formatMessage({ name: item.name, version: item.version }),
        });
        return;
      }
      const formatMessage = pickCredentialsMessage(
        level,
        isAdminAndPublic,
        labels.loginSuccess,
      );
      onNotify({
        variant: NotificationVariant.Success,
        title: labels.loginSuccessTitle,
        message: formatMessage({ name: item.name, version: item.version }),
      });
    },
    [isAdmin, labels, onNotify],
  );

  const showLogoutSuccess = useCallback(
    (item: CatalogItem, level: CredentialsLevel) => {
      const isAdminAndPublic = isAdmin && !!item.credentials?.isPublic;
      const isApiKey =
        item.credentials?.authenticationType ===
        ToolsetAuthenticationType.ApiKey;
      if (isApiKey) {
        const formatMessage = pickCredentialsMessage(
          level,
          isAdminAndPublic,
          labels.apiKeyDeletedSuccess,
        );
        onNotify({
          variant: NotificationVariant.Success,
          title: labels.apiKeyDeletedSuccessTitle,
          message: formatMessage({ name: item.name, version: item.version }),
        });
        return;
      }
      const formatMessage = pickCredentialsMessage(
        level,
        isAdminAndPublic,
        labels.logoutSuccess,
      );
      onNotify({
        variant: NotificationVariant.Success,
        title: labels.logoutSuccessTitle,
        message: formatMessage({ name: item.name, version: item.version }),
      });
    },
    [isAdmin, labels, onNotify],
  );

  const { login: loginToolsetShared } = useToolsetLogin({
    callbackPath,
    loginToolset,
    logoutToolset,
    getToolset,
  });

  const handleLogin = useCallback(
    async (
      item: CatalogItem,
      params: { level: CredentialsLevel; apiKey?: string },
    ) => {
      const authenticationType = item.credentials?.authenticationType;
      const credentialsLevel =
        params.level === CredentialsLevel.User
          ? ToolsetCredentialsLevel.User
          : ToolsetCredentialsLevel.Global;
      const toolset = toolsets.find((candidate) => candidate.id === item.id);

      const outcome = await loginToolsetShared({
        toolsetId: item.id,
        credentialsLevel,
        authenticationType: toToolsetAuthType(authenticationType),
        apiKey: params.apiKey,
        oauthSettings: {
          clientId: toolset?.authSettings?.clientId,
          authorizationEndpoint: toolset?.authSettings?.authorizationEndpoint,
          scopes: toolset?.authSettings?.scopesSupported,
          codeChallenge: toolset?.authSettings?.codeChallenge,
          codeChallengeMethod: toolset?.authSettings?.codeChallengeMethod,
        },
        isCurrentlyFailed:
          getLevelStatus(item, params.level) === CredentialStatus.Failed,
      });

      switch (outcome.type) {
        case ToolsetLoginOutcomeType.Success:
          showLoginSuccess(item, params.level);
          await refetchToolsets();
          return;
        case ToolsetLoginOutcomeType.PopupBlocked:
          onNotify({
            variant: NotificationVariant.Error,
            message: labels.popupBlockedError,
          });
          return;
        case ToolsetLoginOutcomeType.Failure:
          onNotify({
            variant: NotificationVariant.Error,
            message: labels.loginFailedError,
          });
          return;
        case ToolsetLoginOutcomeType.Cancelled:
          // Silent — a genuine cancel needs no notification.
          return;
      }
    },
    [
      toolsets,
      labels,
      onNotify,
      getLevelStatus,
      showLoginSuccess,
      refetchToolsets,
      loginToolsetShared,
    ],
  );

  const handleLogout = useCallback(
    async (item: CatalogItem, params: { level: CredentialsLevel }) => {
      const credentialsLevel =
        params.level === CredentialsLevel.User
          ? ToolsetCredentialsLevel.User
          : ToolsetCredentialsLevel.Global;
      try {
        const body: ToolsetLogoutBodyDto = {
          url: item.id,
          credentialsLevel,
          authenticationType: item.credentials?.authenticationType,
        };
        await logoutToolset(item.id, body);
        showLogoutSuccess(item, params.level);
        await refetchToolsets();
      } catch (error) {
        const { traceId } = await getApiErrorDetails(error);
        onNotify({
          variant: NotificationVariant.Error,
          message: labels.logoutFailedError,
          requestId: traceId,
        });
      }
    },
    [logoutToolset, labels, onNotify, showLogoutSuccess, refetchToolsets],
  );

  return {
    handleLogin,
    handleLogout,
  };
};
