import type { components } from '@epam/ai-dial-typescript-sdk';
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { EnvironmentVariables } from '../config/environment.config';
import { DialClientService } from '../dial/dial-client.service';
import { AcceptInvitationResponseDto } from './dto/accept-invitation-response.dto';
import { CreateShareLinkDto, ShareAccess } from './dto/create-share-link.dto';
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
 * render (which then accepts the invitation and redirects into the
 * catalog), not at DIAL Core's own `/v1/invitations/{id}` API path.
 */
const SHARE_INVITATION_ROUTE_PATH = '/catalog/shared';

/** Creates share links for catalog entities by proxying DIAL Core's resource-sharing API. */
@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);
  private readonly appOrigin: string;

  constructor(
    private readonly dialClient: DialClientService,
    private readonly configService: ConfigService<EnvironmentVariables>,
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
  private buildInvitationUrl(invitationLink: string): string {
    const { pathname } = new URL(invitationLink, this.appOrigin);
    const invitationId = pathname.split('/').filter(Boolean).pop();
    if (!invitationId) {
      throw new BadGatewayException(
        'DIAL Core returned an invalid invitation link',
      );
    }
    return `${this.appOrigin}${SHARE_INVITATION_ROUTE_PATH}/${invitationId}`;
  }

  /**
   * Creates a share link for a catalog entity via DIAL Core.
   *
   * @throws {BadGatewayException} When DIAL Core returns an error response
   * @throws {ServiceUnavailableException} When DIAL Core is unreachable or times out
   */
  async createShareLink(
    accessToken: string,
    { itemId, access }: CreateShareLinkDto,
  ): Promise<ShareLinkResponseDto> {
    let result;
    try {
      const permissions = Array.from(
        new Set(access.flatMap((level) => ACCESS_PERMISSIONS[level])),
      );
      result = await this.dialClient.client.shareResource({
        headers: getBearerAuthHeaders(accessToken),
        body: {
          invitationType: 'LINK',
          resources: [{ url: itemId, permissions }],
        },
      });
    } catch (err) {
      return handleDialFetchError(err, 'create share link', this.logger, 0);
    }

    if (result.error) {
      return mapDialHttpStatus(
        result.response.status,
        'create share link',
        this.logger,
      );
    }

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
      url: this.buildInvitationUrl(invitationLink),
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
  ): Promise<AcceptInvitationResponseDto> {
    let result;
    try {
      result = await this.dialClient.client.getInvitation(invitationId, {
        headers: getBearerAuthHeaders(accessToken),
        params: { query: { accept: true } },
      });
    } catch (err) {
      return handleDialFetchError(err, 'accept invitation', this.logger, 0);
    }

    if (result.error) {
      return mapDialHttpStatus(
        result.response.status,
        'accept invitation',
        this.logger,
      );
    }

    const itemId = result.data?.resources?.[0]?.url;
    if (itemId == null) {
      this.logger.error(
        `DIAL Core returned an invitation with no shared resource for invitationId=${invitationId}`,
      );
      throw new BadGatewayException(
        'DIAL Core returned an invitation with no shared resource',
      );
    }

    this.logger.debug(`Accepted invitation for invitationId=${invitationId}`);

    return { itemId };
  }
}
