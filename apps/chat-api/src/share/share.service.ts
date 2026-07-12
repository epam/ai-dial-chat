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
   * DIAL Core's `invitationLink` is host-relative (it doesn't know the
   * frontend's public origin), so the app's own origin is prepended to
   * produce an absolute, shareable URL.
   */
  private toAbsoluteUrl(invitationLink: string): string {
    if (/^https?:\/\//i.test(invitationLink)) {
      return invitationLink;
    }
    return `${this.appOrigin}/${invitationLink.replace(/^\/+/, '')}`;
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
      result = await this.dialClient.client.shareResource({
        headers: getBearerAuthHeaders(accessToken),
        body: {
          invitationType: 'LINK',
          resources: [{ url: itemId, permissions: ACCESS_PERMISSIONS[access] }],
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
      url: this.toAbsoluteUrl(invitationLink),
      expiresInDays: SHARE_LINK_EXPIRES_IN_DAYS,
      access,
    };
  }
}
