import type { components } from '@epam/ai-dial-typescript-sdk';
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
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
import { CreateShareLinkDto, ShareAccess } from './dto/create-share-link.dto';
import { DiscardSharedCatalogItemResponseDto } from './dto/discard-shared-catalog-item.dto';
import { ShareLinkResponseDto } from './dto/share-link-response.dto';

type ResourceAccessType = components['schemas']['ResourceAccessType'];

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

const getInvitationRoutePath = (itemId: string): string =>
  itemId.startsWith(CONVERSATION_RESOURCE_PREFIX)
    ? CONVERSATION_SHARE_INVITATION_ROUTE_PATH
    : CATALOG_SHARE_INVITATION_ROUTE_PATH;

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
   * Creates a share link for a DIAL Core resource (catalog entity or conversation).
   *
   * @throws {BadGatewayException} When DIAL Core returns an error response
   * @throws {ServiceUnavailableException} When DIAL Core is unreachable or times out
   */
  async createShareLink(
    accessToken: string,
    { itemId, access }: CreateShareLinkDto,
  ): Promise<ShareLinkResponseDto> {
    const permissions = Array.from(
      new Set(access.flatMap((level) => ACCESS_PERMISSIONS[level])),
    );
    const requestBody = {
      invitationType: 'LINK' as const,
      resources: [{ url: itemId, permissions }],
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
      `DIAL Core share link response for itemId=${itemId}: ${JSON.stringify(result.data)}`,
    );

    const invitationLink = result.data?.invitationLink;
    if (invitationLink == null) {
      this.logger.error(
        `DIAL Core returned an empty invitation link for itemId=${itemId}`,
      );
      throw new BadGatewayException(
        'DIAL Core returned an empty invitation link',
      );
    }

    this.logger.debug(`Created share link for itemId=${itemId}`);

    return {
      url: this.buildInvitationUrl(invitationLink, itemId),
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

    if (acceptResult.error) {
      return mapDialHttpStatus(
        acceptResult.response.status,
        'accept invitation',
        this.logger,
        acceptResult.error,
      );
    }

    this.logger.debug(`Accepted invitation for invitationId=${invitationId}`);

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

    return { itemId };
  }

  /**
   * Discards the calling user's own access to a catalog resource shared with
   * them, via DIAL Core `discardSharedResources`. This only affects the
   * caller — removing access for everyone else is the separate, out-of-scope
   * `revokeSharedResources` operation.
   *
   * @throws {ForbiddenException} When the resource is not shared with the caller
   * @throws {BadGatewayException} When DIAL Core returns an error response
   * @throws {ServiceUnavailableException} When DIAL Core is unreachable or times out
   */
  async discardShared(
    itemId: string,
    accessToken: string,
    userSub: string,
  ): Promise<DiscardSharedCatalogItemResponseDto> {
    this.logger.log('Discard shared resource started');

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
      return mapDialHttpStatus(
        result.response.status,
        'share.discardShared',
        this.logger,
        result.error,
      );
    }

    await Promise.all([
      this.deploymentsService.invalidateListCache(userSub),
      this.toolsetsService.invalidateListCache(userSub),
    ]);

    this.logger.log('Discard shared resource completed: success=true');
    return { success: true };
  }
}
