import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import {
  countRecipientsByUrl,
  resolveRecipientsCount,
} from '../../common/utils/resource-ownership';
import { safeDecodeURIComponent } from '../../common/utils/uri';
import { DeploymentsService } from '../../deployments/deployments.service';
import { DialClientService } from '../../dial/dial-client.service';
import { ToolsetsService } from '../../toolsets/toolsets.service';
import { DiscardSharedCatalogItemResponseDto } from '../dto/discard-shared-catalog-item.dto';
import { RevokeSharedAccessResponseDto } from '../dto/revoke-shared-access.dto';
import { ShareRecipientsResponseDto } from '../dto/share-recipients.dto';
import {
  resolveResourceKind,
  toShareResourceUrl,
} from '../utils/share-resource.util';

/** Manages already-granted share access for DIAL Core resources (catalog entities, prompts, or conversations) by proxying DIAL Core's resource-sharing API. */
@Injectable()
export class ShareManagementService {
  private readonly logger = new Logger(ShareManagementService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly deploymentsService: DeploymentsService,
    private readonly toolsetsService: ToolsetsService,
  ) {}

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
    resourceUrl: string,
    accessToken: string,
  ): Promise<boolean> {
    let result;
    try {
      result = await this.dialClient.client.getSharedResources({
        headers: getBearerAuthHeaders(accessToken),
        body: {
          resourceTypes: [resolveResourceKind(resourceUrl)],
          with: 'me',
        },
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

    /*
     * Both encodings are tried, same as `getRecipientsCount`: list ids and
     * DIAL Core share urls differ in percent-encoding for some resource
     * types (conversations in particular), so an exact match against only
     * one form would wrongly report "not shared" for a genuinely-shared
     * resource whose name needs percent-encoding (a space, for instance).
     */
    const decodedResourceUrl = safeDecodeURIComponent(resourceUrl);
    return (result.data?.resources ?? []).some(
      (resource) =>
        resource.url === resourceUrl || resource.url === decodedResourceUrl,
    );
  }

  /**
   * Discards the calling user's own access to a catalog resource shared with
   * them, via DIAL Core `discardSharedResources`. This only affects the
   * caller — removing access for everyone else is the owner-side
   * {@link ShareManagementService.revokeShared} operation.
   *
   * `itemId` is always a full DIAL Core resource path, including for a
   * shared-with-the-caller prompt — it already embeds its owner's bucket,
   * not the caller's own.
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

    const resourceUrl = toShareResourceUrl(itemId);

    /*
     * Read before calling discard, not after: once discard runs, a resource
     * that really was shared is no longer shared either, so checking
     * afterwards can't tell a genuine discard apart from the no-op case this
     * is meant to catch.
     */
    const wasSharedWithCaller = await this.isSharedWithCaller(
      resourceUrl,
      accessToken,
    );

    let result;
    try {
      result = await this.dialClient.client.discardSharedResources({
        headers: getBearerAuthHeaders(accessToken),
        body: { resources: [{ url: resourceUrl }] },
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

  /**
   * Counts how many users currently hold shared access to one resource the
   * caller owns, via DIAL Core `getSharedResources({ with: 'others' })`.
   *
   * Answered per resource, on demand — the frontend calls this when the owner
   * opens the action menu that offers {@link ShareManagementService.revokeShared},
   * so a count is never older than the menu showing it. DIAL Core has no
   * single-resource variant of this query, so the whole `with: 'others'` set
   * for the resource's kind is fetched and the one entry is picked out of it.
   *
   * `sharedWith` only lists users who *accepted* an invitation, so `0` means
   * "nobody holds access", not "never shared" — an issued but unopened share
   * link contributes nothing.
   *
   * `itemId` is always a full DIAL Core resource path, and only its owner
   * ever sees its recipient count.
   *
   * @throws {BadGatewayException} When DIAL Core returns an error response
   * @throws {ServiceUnavailableException} When DIAL Core is unreachable or times out
   */
  async getRecipientsCount(
    itemId: string,
    accessToken: string,
  ): Promise<ShareRecipientsResponseDto> {
    const resourceUrl = toShareResourceUrl(itemId);

    let result;
    try {
      result = await this.dialClient.client.getSharedResources({
        headers: getBearerAuthHeaders(accessToken),
        body: {
          resourceTypes: [resolveResourceKind(resourceUrl)],
          with: 'others',
          includeUserInfo: true,
        },
      });
    } catch (err) {
      return handleDialFetchError(
        err,
        'share.getRecipientsCount',
        this.logger,
        0,
      );
    }

    if (result.error) {
      return mapDialHttpStatus(
        result.response.status,
        'share.getRecipientsCount',
        this.logger,
        result.error,
      );
    }

    const counts = countRecipientsByUrl(
      (result.data?.resources ?? []) as {
        url?: string;
        sharedWith?: unknown[];
      }[],
    );
    /*
     * Both encodings are tried: list ids and DIAL Core share urls differ in
     * percent-encoding for some resource types (conversations in particular).
     */
    const recipientsCount =
      resolveRecipientsCount(
        counts,
        resourceUrl,
        safeDecodeURIComponent(resourceUrl),
      ) ?? 0;

    return { itemId, recipientsCount };
  }

  /**
   * Revokes every outstanding share grant on a resource the caller owns, via
   * DIAL Core `revokeSharedResources`. This affects all recipients at once —
   * DIAL Core's request carries no subject field, so a single recipient
   * cannot be targeted. Discarding only the caller's own access is the
   * recipient-side {@link ShareManagementService.discardShared} operation.
   *
   * Unlike `discardShared` there is no pre-flight `getSharedResources` check:
   * for an owner, a resource that currently has no recipients already has the
   * requested outcome, so DIAL Core's no-op success is the correct answer
   * rather than something to surface as an error. Ownership itself is
   * enforced by DIAL Core, which answers `403` for a non-owner.
   *
   * `itemId` is always a full DIAL Core resource path, and only its owner
   * can revoke its shared access.
   *
   * @throws {NotFoundException} When the resource does not exist
   * @throws {BadGatewayException} When DIAL Core returns an error response
   * @throws {ServiceUnavailableException} When DIAL Core is unreachable or times out
   */
  async revokeShared(
    itemId: string,
    accessToken: string,
    userSub: string,
  ): Promise<RevokeSharedAccessResponseDto> {
    this.logger.log('Revoke shared access started');

    const resourceUrl = toShareResourceUrl(itemId);

    let result;
    try {
      result = await this.dialClient.client.revokeSharedResources({
        headers: getBearerAuthHeaders(accessToken),
        body: { resources: [{ url: resourceUrl }] },
      });
    } catch (err) {
      return handleDialFetchError(err, 'share.revokeShared', this.logger, 0);
    }

    if (result.error) {
      /*
       * Same reasoning as `discardShared`: DIAL Core has no dedicated status
       * for "itemId is well-formed but resolves to no resource" and answers a
       * generic `400`. `RevokeSharedAccessDto` already rejects malformed
       * itemIds before this method runs, so any `400` reaching here can only
       * be the not-found case.
       */
      if (result.response.status === 400) {
        throw new NotFoundException('Resource does not exist');
      }
      return mapDialHttpStatus(
        result.response.status,
        'share.revokeShared',
        this.logger,
        result.error,
      );
    }

    await Promise.all([
      this.deploymentsService.invalidateListCache(userSub),
      this.toolsetsService.invalidateListCache(userSub),
    ]);

    this.logger.log('Revoke shared access completed: success=true');
    return { success: true };
  }
}
