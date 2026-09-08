import type { components } from '@epam/ai-dial-typescript-sdk';
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  handleDialFetchError,
  handleDialSdkError,
  mapDialHttpStatus,
} from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { EnvironmentVariables } from '../../config/environment.config';
import { PUBLIC_BUCKET } from '../../conversations/constants/conversation.constants';
import { resolveConversationLocation } from '../../conversations/utils/conversation.utils';
import { DeploymentsService } from '../../deployments/deployments.service';
import { DialClientService } from '../../dial/dial-client.service';
import { isPromptResourceUrl } from '../../prompts/utils/prompt-mapper.util';
import { getResourceBucket } from '../../publish/publish-target.util';
import { SkillsLookupService } from '../../skills/lookup/skills-lookup.service';
import { ToolsetsService } from '../../toolsets/toolsets.service';
import { AcceptInvitationResponseDto } from '../dto/accept-invitation-response.dto';
import { CreateShareLinkDto, ShareAccess } from '../dto/create-share-link.dto';
import { ShareLinkResponseDto } from '../dto/share-link-response.dto';
import {
  CONVERSATION_RESOURCE_PREFIX,
  FILE_RESOURCE_PREFIX,
  collectConversationResourceUrls,
  getInvitationRoutePath,
  isAlreadyOwnedError,
  toShareResourceUrl,
} from '../utils/share-resource.util';

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

/** Creates and consumes share invitations for DIAL Core resources (catalog entities, prompts, or conversations) by proxying DIAL Core's resource-sharing API. */
@Injectable()
export class ShareInvitationService {
  private readonly logger = new Logger(ShareInvitationService.name);
  private readonly appOrigin: string;

  constructor(
    private readonly dialClient: DialClientService,
    private readonly configService: ConfigService<EnvironmentVariables>,
    private readonly deploymentsService: DeploymentsService,
    private readonly toolsetsService: ToolsetsService,
    private readonly skillsLookupService: SkillsLookupService,
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

  private async getRelatedResourceUrls(
    accessToken: string,
    sessionBucket: string,
    resourceUrl: string,
  ): Promise<string[]> {
    if (!resourceUrl.startsWith(CONVERSATION_RESOURCE_PREFIX)) return [];

    const conversationPath = resourceUrl.slice(
      CONVERSATION_RESOURCE_PREFIX.length,
    );
    const { bucket, subPath } = resolveConversationLocation(
      conversationPath,
      sessionBucket,
    );

    let result;
    try {
      result = await this.dialClient.client.getConversation(
        bucket,
        encodeDialResourcePath(subPath),
        { headers: getBearerAuthHeaders(accessToken) },
      );
    } catch (err) {
      return handleDialSdkError(
        err,
        'load conversation resources before sharing',
        this.logger,
      );
    }

    if (result.error != null) {
      return handleDialSdkError(
        result.error,
        'load conversation resources before sharing',
        this.logger,
        result.response,
      );
    }
    if (result.data == null) {
      this.logger.error(
        `DIAL Core returned an empty conversation for resourceUrl=${resourceUrl}`,
      );
      throw new BadGatewayException('DIAL Core returned an empty conversation');
    }

    /* See openspec/specs/conversation-share/spec.md — "Related file resources outside the conversation's own bucket are dropped". */
    return collectConversationResourceUrls(result.data).filter((url) => {
      const fileBucket = getResourceBucket(url);
      return fileBucket === bucket || fileBucket === PUBLIC_BUCKET;
    });
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
    { itemId, access }: CreateShareLinkDto,
  ): Promise<ShareLinkResponseDto> {
    const resourceUrl = toShareResourceUrl(itemId);
    const permissions = Array.from(
      new Set(access.flatMap((level) => ACCESS_PERMISSIONS[level])),
    );
    const relatedResourceUrls = await this.getRelatedResourceUrls(
      accessToken,
      bucket,
      resourceUrl,
    );
    const requestBody = {
      invitationType: 'LINK' as const,
      resources: [resourceUrl, ...relatedResourceUrls].map((url) => ({
        url,
        permissions,
      })),
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

    const resources = peekResult.data?.resources ?? [];
    const itemId =
      resources.find((r) => !r.url?.startsWith(FILE_RESOURCE_PREFIX))?.url ??
      resources[0]?.url;
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
    Pick<
      AcceptInvitationResponseDto,
      'sharedDeployment' | 'sharedToolset' | 'sharedSkill'
    >
  > {
    try {
      if (itemId.startsWith('skills/')) {
        const sharedSkill = await this.skillsLookupService.resolveSkillItem(
          itemId,
          accessToken,
          bucket,
        );
        return sharedSkill ? { sharedSkill } : {};
      }

      /*
       * A prompt has no deployments/toolsets list entry to summarise — the
       * frontend picks it up from its own prompts refetch instead.
       */
      if (isPromptResourceUrl(itemId)) return {};

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
}
