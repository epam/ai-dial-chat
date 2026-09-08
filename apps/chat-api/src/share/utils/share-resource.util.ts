import type { components } from '@epam/ai-dial-typescript-sdk';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { isPromptResourceUrl } from '../../prompts/utils/prompt-mapper.util';

type ResourceKind = components['schemas']['ResourceTypes'];

/*
 * `discardShared`/`revokeShared`/`getRecipientsCount` always receive an
 * `itemId` that is already a full DIAL Core resource url — the DTO's regex
 * validation enforces one of these prefixes before this ever runs — so
 * `resolveResourceKind` below always finds a match. This table exists purely
 * to translate that prefix into the `resourceTypes` filter
 * `getSharedResources` expects.
 */
const RESOURCE_KIND_BY_PREFIX: [prefix: string, kind: ResourceKind][] = [
  ['applications/', 'APPLICATION'],
  ['toolsets/', 'TOOL_SET'],
  ['conversations/', 'CONVERSATION'],
  ['skills/', 'SKILL'],
  ['prompts/', 'PROMPT'],
];

export const resolveResourceKind = (itemId: string): ResourceKind => {
  const match = RESOURCE_KIND_BY_PREFIX.find(([prefix]) =>
    itemId.startsWith(prefix),
  );
  if (!match)
    throw new Error(`Unrecognized resource kind for itemId: ${itemId}`);
  return match[1];
};

/*
 * Prompts are the one resource kind whose public `itemId` is deliberately
 * decoded back to a raw, human-readable DIAL Core resource path
 * (`buildPromptId` rebuilds it from a `safeDecodeURIComponent`d metadata
 * url — see `urlToPromptPath` — so folder/prompt names with spaces stay
 * literal wherever the id is displayed). Every other kind's listing passes
 * DIAL Core's own metadata url straight through unchanged (conversations:
 * `conversation-listing.service.ts`; applications/toolsets: `raw.id` in
 * their mapper utils), so their `itemId` already matches whatever encoded
 * or unencoded form DIAL Core itself uses — re-encoding it here would risk
 * disagreeing with that native form. Only prompts need re-encoding back to
 * DIAL Core's canonical form before this direct SDK call boundary.
 *
 * TODO: once prompts stop decoding at listing time (aligning them with the
 * conversations pattern — using metadata's native `name`/`parentPath`
 * fields instead of deriving from a decoded path), this conditional goes
 * away entirely and `itemId` can be used as-is for every kind.
 */
export const toShareResourceUrl = (itemId: string): string =>
  isPromptResourceUrl(itemId) ? encodeDialResourcePath(itemId) : itemId;

/*
 * The generated share link must point at a frontend route the SPA can
 * render (which then accepts the invitation and redirects into the shared
 * resource), not at DIAL Core's own `/v1/invitations/{id}` API path. Which
 * frontend route depends on the resource kind: catalog entities land on the
 * catalog accept-invitation route, conversations on the conversation one, so
 * each redirects into the right place after acceptance.
 *
 * These string literals MUST stay in sync with `ROUTES.SharedInvitation` and
 * `ROUTES.ConversationSharedInvitation` in `apps/chat/src/types/routes.ts` —
 * apps cannot import each other's route constants across the Nx module
 * boundary, so there is no single shared source of truth. Renaming either
 * frontend route without updating the matching constant here (or vice versa)
 * compiles cleanly but silently breaks the generated share link. The tests
 * in `share-invitation.service.spec.ts` assert the exact URL prefix for both
 * kinds — update them alongside any rename here.
 */
const CATALOG_SHARE_INVITATION_ROUTE_PATH = '/catalog/shared';
const CONVERSATION_SHARE_INVITATION_ROUTE_PATH = '/conversations/shared';

/** DIAL Core conversation resource paths always start with this prefix. */
export const CONVERSATION_RESOURCE_PREFIX = 'conversations/';
export const FILE_RESOURCE_PREFIX = 'files/';

export const getInvitationRoutePath = (itemId: string): string =>
  itemId.startsWith(CONVERSATION_RESOURCE_PREFIX)
    ? CONVERSATION_SHARE_INVITATION_ROUTE_PATH
    : CATALOG_SHARE_INVITATION_ROUTE_PATH;

/*
 * DIAL Core rejects `?accept=true` with 400 and a body like
 * `"Resource <id> already belong to you"` when the invited user already owns
 * (or previously accepted) the shared resource — e.g. opening your own share
 * link, or reopening a link you already accepted. That's not a real failure:
 * the user already has access, so the accept call is a no-op and the UI
 * should still open the resource's details panel rather than showing an
 * error. Detected by substring match since DIAL Core doesn't give this case
 * its own status code or a machine-readable error field.
 */
export const isAlreadyOwnedError = (errorBody: unknown): boolean =>
  typeof errorBody === 'string' &&
  errorBody.toLowerCase().includes('already belong');

interface AnnotationWithAttachment {
  body?: {
    source?: {
      attachment?: unknown;
    };
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const collectAttachmentResourceUrls = (
  attachments: unknown,
  resourceUrls: Set<string>,
): void => {
  if (!Array.isArray(attachments)) return;

  for (const attachment of attachments) {
    if (!isRecord(attachment)) continue;

    for (const field of ['url', 'reference_url'] as const) {
      const url = attachment[field];
      if (typeof url !== 'string') continue;

      const resourceUrl = url.split('#', 1)[0];
      if (resourceUrl.startsWith(FILE_RESOURCE_PREFIX)) {
        resourceUrls.add(resourceUrl);
      }
    }
  }
};

/** Collects unique DIAL file resources referenced by messages, stages, and citations. */
export const collectConversationResourceUrls = (
  conversation: unknown,
): string[] => {
  if (!isRecord(conversation) || !Array.isArray(conversation.messages)) {
    return [];
  }

  const resourceUrls = new Set<string>();
  for (const message of conversation.messages) {
    if (!isRecord(message) || !isRecord(message.custom_content)) continue;

    collectAttachmentResourceUrls(
      message.custom_content.attachments,
      resourceUrls,
    );

    const stages = message.custom_content.stages;
    if (Array.isArray(stages)) {
      for (const stage of stages) {
        if (isRecord(stage)) {
          collectAttachmentResourceUrls(stage.attachments, resourceUrls);
        }
      }
    }

    const annotations = message.custom_content.annotations;
    if (!Array.isArray(annotations)) continue;
    for (const annotation of annotations) {
      const attachment = (annotation as AnnotationWithAttachment)?.body?.source
        ?.attachment;
      collectAttachmentResourceUrls([attachment], resourceUrls);
    }
  }

  return [...resourceUrls];
};
