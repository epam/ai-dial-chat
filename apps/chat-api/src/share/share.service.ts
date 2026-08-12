import type { components } from '@epam/ai-dial-typescript-sdk';
import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { EnvironmentVariables } from '../config/environment.config';
import { DeploymentsService } from '../deployments/deployments.service';
import { DialClientService } from '../dial/dial-client.service';
import { ToolsetsService } from '../toolsets/toolsets.service';
import { AcceptInvitationResponseDto } from './dto/accept-invitation-response.dto';
import {
  CreateShareLinkDto,
  ShareAccess,
  ShareResourceKind,
} from './dto/create-share-link.dto';
import { DiscardSharedCatalogItemResponseDto } from './dto/discard-shared-catalog-item.dto';
import { ShareLinkResponseDto } from './dto/share-link-response.dto';

type ResourceAccessType = components['schemas']['ResourceAccessType'];
type ResourceKind = components['schemas']['ResourceTypes'];

/*
 * `DiscardSharedCatalogItemDto` only accepts an `itemId` starting with one of
 * these three prefixes, so `resolveResourceKind` below always finds a match —
 * this table exists purely to translate that prefix into the `resourceTypes`
 * filter `getSharedResources` expects.
 */
const RESOURCE_KIND_BY_PREFIX: [prefix: string, kind: ResourceKind][] = [
  ['applications/', 'APPLICATION'],
  ['toolsets/', 'TOOL_SET'],
  ['conversations/', 'CONVERSATION'],
];

const resolveResourceKind = (itemId: string): ResourceKind =>
  RESOURCE_KIND_BY_PREFIX.find(([prefix]) => itemId.startsWith(prefix))![1];

/*
 * DIAL Core's `shareResource` endpoint does not return an expiry; the link
 * expiry is a fixed platform default rather than something DIAL Core reports
 * back per-request.
 */
const SHARE_LINK_EXPIRES_IN_DAYS = 3;

const ACCESS_PERMISSIONS: Record<ShareAccess, ResourceAccessType[]> = {
  [ShareAccess.View]: ['READ'],
  [ShareAccess.Edit]: ['READ', 'WRITE'],
};

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
 * in `share.service.spec.ts` assert the exact URL prefix for both kinds —
 * update them alongside any rename here.
 */
const CATALOG_SHARE_INVITATION_ROUTE_PATH = '/catalog/shared';
const CONVERSATION_SHARE_INVITATION_ROUTE_PATH = '/conversations/shared';

/** DIAL Core conversation resource paths always start with this prefix. */
const CONVERSATION_RESOURCE_PREFIX = 'conversations/';

/** DIAL Core prompt resource paths always start with this prefix. */
const PROMPT_RESOURCE_PREFIX = 'prompts/';

/*
 * The prompts endpoints address a prompt by a bucket-relative path
 * (`Work/AI/summarize`), because every one of them already scopes to the
 * caller's bucket. DIAL Core's sharing API instead wants the fully-qualified
 * resource url, so the bucket is re-attached here rather than being leaked
 * into the frontend, which never sees it.
 */
const toPromptResourceUrl = (promptPath: string, bucket: string): string =>
  `${PROMPT_RESOURCE_PREFIX}${bucket}/${promptPath}`;

const getInvitationRoutePath = (itemId: string): string =>
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
const isAlreadyOwnedError = (errorBody: unknown): boolean =>
  typeof errorBody === 'string' &&
  errorBody.toLowerCase().includes('already belong');

/** Creates share links for DIAL Core resources (catalog entities or conversations) by proxying DIAL Core's resource-sharing API. */
@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);
  private readonly appOrigin: string;

  constructor(
    private readonly dialClient: DialClientService,
    private readonly configService: ConfigService<EnvironmentVariables>,
    private readonly deploymentsService: DeploymentsService,
    private readonly toolsetsService: ToolsetsService,
  ) {
    const callbackBaseUrl = this.configService.get('AUTH_CALLBACK_BASE_URL', {
      infer: true,
    });
    this.appOrigin = new URL(callbackBaseUrl).origin;
  }

  /*
   * DIAL Core's `invitationLink` (e.g. `/v1/invitations/{id}`) is an API
   * path, not a page the SPA can render, and it's host-relative to DIAL
   * Core rather than the frontend's public origin. Only the trailing id
   * segment is reused, to build an absolute frontend URL that lands on the
   * SPA's own accept-invitation route.
   */
  private buildInvitationUrl(invitationLink: string, itemId: string): string {
    const { pathname } = new URL(invitationLink, this.appOrigin);
    const invitationId = pathname.split('/').filter(Boolean).pop();
    if (!invitationId) {
      throw new BadGatewayException(
        'DIAL Core returned an invalid invitation link',
      );
    }
    return `${this.appOrigin}${getInvitationRoutePath(itemId)}/${invitationId}`;
  }

  /**
   * Creates a share link for a DIAL Core resource (catalog entity, prompt, or conversation).
   *
   * @throws {BadGatewayException} When DIAL Core returns an error response
   * @throws {ServiceUnavailableException} When DIAL Core is unreachable or times out
   */
  async createShareLink(
    accessToken: string,
    bucket: string,
    { itemId, access, resourceKind }: CreateShareLinkDto,
  ): Promise<ShareLinkResponseDto> {
    const resourceUrl =
      resourceKind === ShareResourceKind.Prompt
        ? toPromptResourceUrl(itemId, bucket)
        : itemId;
    const permissions = Array.from(
      new Set(access.flatMap((level) => ACCESS_PERMISSIONS[level])),
    );
    const requestBody = {
      invitationType: 'LINK' as const,
      resources: [{ url: resourceUrl, permissions }],
    };
    this.logger.debug(
      `Requesting share link from DIAL Core: ${JSON.stringify(requestBody)}`,
    );

    let result;
    try {
      result = await this.dialClient.client.shareResource({
        headers: getBearerAuthHeaders(accessToken),
        body: requestBody,
      });
    } catch (err) {
      return handleDialFetchError(err, 'create share link', this.logger, 0);
    }

    if (result.error) {
      return mapDialHttpStatus(
        result.response.status,
        'create share link',
        this.logger,
        result.error,
      );
    }

    this.logger.debug(
      `DIAL Core share link response for itemId=${resourceUrl}: ${JSON.stringify(result.data)}`,
    );

    const invitationLink = result.data?.invitationLink;
    if (invitationLink == null) {
      this.logger.error(
        `DIAL Core returned an empty invitation link for itemId=${resourceUrl}`,
      );
      throw new BadGatewayException(
        'DIAL Core returned an empty invitation link',
      );
    }

    this.logger.debug(`Created share link for itemId=${resourceUrl}`);

    return {
      url: this.buildInvitationUrl(invitationLink, resourceUrl),
      expiresInDays: SHARE_LINK_EXPIRES_IN_DAYS,
      access,
    };
  }

  /**
   * Accepts a share invitation via DIAL Core, granting the authenticated
   * user its access level, and returns the shared entity's identifier.
   *
   * @throws {BadGatewayException} When DIAL Core returns an error response
   * @throws {ServiceUnavailableException} When DIAL Core is unreachable or times out
   */
  async acceptInvitation(
    accessToken: string,
    invitationId: string,
    userSub: string,
    bucket: string,
  ): Promise<AcceptInvitationResponseDto> {
    this.logger.debug(
      `Peeking invitation from DIAL Core for invitationId=${invitationId}`,
    );

    /*
     * DIAL Core's `?accept=true` performs the accept side effect but returns
     * an empty 200 body rather than the `Invitation` payload its OpenAPI
     * schema declares — confirmed by logging the raw response body, which
     * came back empty. So the shared resource's itemId has to be read from a
     * separate, non-accepting peek call before the accepting call runs.
     */
    let peekResult;
    try {
      peekResult = await this.dialClient.client.getInvitation(invitationId, {
        headers: getBearerAuthHeaders(accessToken),
      });
    } catch (err) {
      return handleDialFetchError(err, 'peek invitation', this.logger, 0);
    }

    if (peekResult.error) {
      return mapDialHttpStatus(
        peekResult.response.status,
        'peek invitation',
        this.logger,
        peekResult.error,
      );
    }

    const itemId = peekResult.data?.resources?.[0]?.url;
    if (itemId == null) {
      this.logger.error(
        `DIAL Core returned an invitation with no shared resource for invitationId=${invitationId}`,
      );
      throw new BadGatewayException(
        'DIAL Core returned an invitation with no shared resource',
      );
    }

    this.logger.debug(
      `Accepting invitation from DIAL Core for invitationId=${invitationId}, itemId=${itemId}`,
    );

    let acceptResult;
    try {
      acceptResult = await this.dialClient.client.getInvitation(invitationId, {
        headers: getBearerAuthHeaders(accessToken),
        params: { query: { accept: true } },
      });
    } catch (err) {
      return handleDialFetchError(err, 'accept invitation', this.logger, 0);
    }

    if (
      acceptResult.error &&
      !(
        acceptResult.response.status === 400 &&
        isAlreadyOwnedError(acceptResult.error)
      )
    ) {
      return mapDialHttpStatus(
        acceptResult.response.status,
        'accept invitation',
        this.logger,
        acceptResult.error,
      );
    }

    this.logger.debug(
      acceptResult.error
        ? `Invitation invitationId=${invitationId} resolves to a resource the user already owns; treating as accepted`
        : `Accepted invitation for invitationId=${invitationId}`,
    );

    /*
     * The deployments/toolsets lists are cached per user for 30s
     * (`DeploymentsService`/`ToolsetsService`). Without invalidating them
     * here, the frontend's post-accept refetch can still serve the
     * pre-share snapshot, so the catalog's details panel silently fails to
     * find the newly shared item.
     */
    await Promise.all([
      this.deploymentsService.invalidateListCache(userSub),
      this.toolsetsService.invalidateListCache(userSub),
    ]);

    const summary = await this.resolveSharedItemSummary(
      itemId,
      accessToken,
      userSub,
      bucket,
    );

    return { itemId, ...summary };
  }

  /**
   * Resolves the just-accepted item's list-item summary by id, so the
   * frontend can show it immediately instead of depending on a subsequent
   * bulk deployments/toolsets list refresh reflecting the grant — DIAL Core
   * does not guarantee that a `listDeployments`/`getSharedResources` call
   * immediately after an accept already includes the newly shared resource.
   *
   * Best-effort: any failure here (resolution error, or DIAL Core genuinely
   * has no match yet) resolves to an empty object rather than throwing — the
   * invitation was already successfully accepted upstream, so a summary
   * lookup failure must not fail the whole `acceptInvitation` call.
   */
  private async resolveSharedItemSummary(
    itemId: string,
    accessToken: string,
    userSub: string,
    bucket: string,
  ): Promise<
    Pick<AcceptInvitationResponseDto, 'sharedDeployment' | 'sharedToolset'>
  > {
    try {
      /*
       * A prompt has no deployments/toolsets list entry to summarise — the
       * frontend picks it up from its own prompts refetch instead.
       */
      if (itemId.startsWith(PROMPT_RESOURCE_PREFIX)) return {};

      if (itemId.startsWith('toolsets/')) {
        const sharedToolset = await this.toolsetsService.resolveToolsetItem(
          userSub,
          accessToken,
          itemId,
        );
        return sharedToolset ? { sharedToolset } : {};
      }

      const sharedDeployment =
        await this.deploymentsService.resolveDeploymentItem(
          itemId,
          accessToken,
          bucket,
        );
      if (sharedDeployment) return { sharedDeployment };

      if (!itemId.startsWith('applications/')) {
        const sharedToolset = await this.toolsetsService.resolveToolsetItem(
          userSub,
          accessToken,
          itemId,
        );
        if (sharedToolset) return { sharedToolset };
      }

      return {};
    } catch (err) {
      this.logger.warn(
        `Failed to resolve shared item summary for itemId=${itemId}`,
        err,
      );
      return {};
    }
  }

  /*
   * DIAL Core's `discardSharedResources` treats a resource that was never
   * shared with the caller as an idempotent no-op — it answers `200` rather
   * than `403` — so a blind pass-through of its response would silently
   * report success without actually removing (or ever having granted) any
   * access. `discardShared` below cross-checks this against
   * `getSharedResources` (the same call the deployments/toolsets list
   * endpoints use to derive `sharedWithMe`), taken *before* calling discard,
   * to tell a genuine discard apart from that silent no-op.
   */
  private async isSharedWithCaller(
    itemId: string,
    accessToken: string,
  ): Promise<boolean> {
    let result;
    try {
      result = await this.dialClient.client.getSharedResources({
        headers: getBearerAuthHeaders(accessToken),
        body: { resourceTypes: [resolveResourceKind(itemId)], with: 'me' },
      });
    } catch (err) {
      return handleDialFetchError(
        err,
        'share.discardShared (verify shared)',
        this.logger,
        0,
      );
    }

    if (result.error) {
      return mapDialHttpStatus(
        result.response.status,
        'share.discardShared (verify shared)',
        this.logger,
        result.error,
      );
    }

    return (result.data?.resources ?? []).some(
      (resource) => resource.url === itemId,
    );
  }

  /**
   * Discards the calling user's own access to a catalog resource shared with
   * them, via DIAL Core `discardSharedResources`. This only affects the
   * caller — removing access for everyone else is the separate, out-of-scope
   * `revokeSharedResources` operation.
   *
   * @throws {ForbiddenException} When the resource is not shared with the caller
   * @throws {NotFoundException} When the resource does not exist
   * @throws {BadGatewayException} When DIAL Core returns an error response
   * @throws {ServiceUnavailableException} When DIAL Core is unreachable or times out
   */
  async discardShared(
    itemId: string,
    accessToken: string,
    userSub: string,
  ): Promise<DiscardSharedCatalogItemResponseDto> {
    this.logger.log('Discard shared resource started');

    /*
     * Read before calling discard, not after: once discard runs, a resource
     * that really was shared is no longer shared either, so checking
     * afterwards can't tell a genuine discard apart from the no-op case this
     * is meant to catch.
     */
    const wasSharedWithCaller = await this.isSharedWithCaller(
      itemId,
      accessToken,
    );

    let result;
    try {
      result = await this.dialClient.client.discardSharedResources({
        headers: getBearerAuthHeaders(accessToken),
        body: { resources: [{ url: itemId }] },
      });
    } catch (err) {
      return handleDialFetchError(err, 'share.discardShared', this.logger, 0);
    }

    if (result.error) {
      /*
       * DIAL Core has no dedicated status for "itemId is well-formed but
       * doesn't resolve to any resource" — it answers a generic `400` here,
       * indistinguishable at the wire level from a truly malformed request.
       * `DiscardSharedCatalogItemDto` already rejects malformed itemIds
       * before this method runs, so any `400` reaching this point can only
       * be DIAL Core's not-found case; map it to the `404` the
       * `catalog-unshare` spec requires.
       */
      if (result.response.status === 400) {
        throw new NotFoundException('Resource does not exist');
      }
      return mapDialHttpStatus(
        result.response.status,
        'share.discardShared',
        this.logger,
        result.error,
      );
    }

    if (!wasSharedWithCaller) {
      this.logger.warn(
        `Discard shared resource rejected: itemId=${itemId} is not shared with the caller`,
      );
      throw new ForbiddenException('Resource is not shared with the caller');
    }

    await Promise.all([
      this.deploymentsService.invalidateListCache(userSub),
      this.toolsetsService.invalidateListCache(userSub),
    ]);

    this.logger.log('Discard shared resource completed: success=true');
    return { success: true };
  }
}
