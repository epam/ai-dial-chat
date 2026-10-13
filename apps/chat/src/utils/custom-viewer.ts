import {
  type ApplicationSchemaSummaryDto,
  type DeploymentItemDto,
  DeploymentItemDtoTypeEnum,
} from '@epam/ai-dial-chat-api-client';

import type {
  CustomViewer,
  CustomViewerUrlParams,
} from '../models/custom-viewer';

const ALLOWED_VIEWER_PROTOCOLS = new Set(['http:', 'https:']);

/** Returns `true` when `value` parses as an absolute `http:`/`https:` URL. */
export const isSafeViewerUrl = (value: string | undefined): value is string => {
  if (!value) return false;
  try {
    return ALLOWED_VIEWER_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
};

const toViewer = (
  url: string,
  title: string | undefined,
  applicationId: string,
): CustomViewer | undefined =>
  /* The title is the postMessage namespace, so a viewer without one can never
   * finish the handshake — treat it as not configured. */
  title ? { url, title, applicationId } : undefined;

/** Returns the Custom Viewer configured for `deployment` (direct `viewerUrl` first, then its schema's), or `undefined`. */
export const resolveCustomViewer = (
  deployment: DeploymentItemDto | undefined,
  schemas: readonly ApplicationSchemaSummaryDto[],
): CustomViewer | undefined => {
  if (deployment?.type !== DeploymentItemDtoTypeEnum.Application) {
    return undefined;
  }

  if (isSafeViewerUrl(deployment.viewerUrl)) {
    return toViewer(
      deployment.viewerUrl,
      deployment.displayName,
      deployment.id,
    );
  }

  const schemaId = deployment.applicationTypeSchemaId;
  if (!schemaId) return undefined;

  const schema = schemas.find((item) => item.id === schemaId);
  if (!isSafeViewerUrl(schema?.viewerUrl)) return undefined;

  return toViewer(schema.viewerUrl, schema.displayName, deployment.id);
};

/** Returns the viewer iframe `src`, or `undefined` when the configured URL is not a safe absolute URL. */
export const buildCustomViewerUrl = ({
  url,
  applicationId,
  conversationId,
  theme,
  authProvider,
}: CustomViewerUrlParams): string | undefined => {
  if (!isSafeViewerUrl(url)) return undefined;

  const target = new URL(url);
  if (authProvider) target.searchParams.set('authProvider', authProvider);
  if (conversationId) target.searchParams.set('conversationId', conversationId);
  target.searchParams.set('id', applicationId);
  if (theme) target.searchParams.set('theme', theme);

  return target.toString();
};

/** Returns `payload.conversation.id` from a viewer conversation event, or `undefined` when it is not a non-empty string. */
export const getViewerConversationId = (
  payload: unknown,
): string | undefined => {
  if (typeof payload !== 'object' || payload == null) return undefined;
  const conversation = (payload as { conversation?: unknown }).conversation;
  if (typeof conversation !== 'object' || conversation == null) {
    return undefined;
  }
  const id = (conversation as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
};

/** Returns a predicate that accepts a key once and rejects repeats of it within `windowMs` (leading edge). */
export const createLeadingDeduper = (
  windowMs: number,
  now: () => number = Date.now,
): ((key: string) => boolean) => {
  const lastSeen = new Map<string, number>();
  return (key) => {
    const time = now();
    const previous = lastSeen.get(key);
    lastSeen.set(key, time);
    return previous == null || time - previous >= windowMs;
  };
};
