import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ApplicationsService } from '../applications/applications.service';
import type { DialApplication } from '../applications/applications.service';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import type { DialApplicationResource } from '../common/utils/dial-application-resource';
import {
  DialResourceType,
  getResourceLeaf,
  transferDialResource,
} from '../common/utils/dial-resource-transfer';
import { DialClientService } from '../dial/dial-client.service';
import { PublishConflictCode } from './dto/publish-conflict.dto';
import { PUBLISH_STAGING_SEGMENT } from './publish-target.util';

/** A copy last modified longer ago than this is the leftover of an interrupted publish and is reclaimed. */
export const STALE_PUBLISH_COPY_AGE_MS = 3 * 60 * 1000;

/** Another publish of the same application holds the temporary copy; the only preparation failure that is not absorbed. */
export class ApplicationBeingPublishedException extends ConflictException {
  constructor() {
    super({
      statusCode: 409,
      message: 'This application is already being published',
      error: 'Conflict',
      code: PublishConflictCode.PublishInProgress,
    });
  }
}

/** A temporary copy of an application, in the author's own bucket. */
export interface ApplicationPublishCopy {
  /** `applications/{bucket}/{path}`, the url DIAL Core is given as the publication's `sourceUrl`. */
  id: string;
  resource: DialApplicationResource;
}

/**
 * Creates and deletes the temporary copy of an application that a
 * publication names as its `sourceUrl`, so the references inside it can be
 * rewritten to the dependencies' published paths while the author's own
 * application is never written. The copy lives at
 * `{original folder}/.publish-staging/{original leaf}`, so one application has
 * at most one copy in flight, and exists only for the length of the
 * `createPublication` call: Core makes its review copies while the request is
 * created and does not read the source again.
 *
 * Known limitations, recorded rather than guarded (design D8): a copy of an
 * application with interceptors is refused by Core for a non-administrator
 * (the publish then falls back to the old path, without dependencies); an application whose
 * schema enables a bucket copy leaves an orphaned bucket behind, and an
 * application with a `function` gets a new function id, both silently; a
 * dependency that is itself an application with private references of its own
 * is published with them unchanged, so calls to it fail for other users.
 */
@Injectable()
export class ApplicationPublishCopyService {
  private readonly logger = new Logger(ApplicationPublishCopyService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly applicationsService: ApplicationsService,
  ) {}

  /**
   * Copies `original` to its staging path and stores the body `rewrite`
   * returns. A copy that already exists blocks the publish with 409, unless it
   * was last modified more than {@link STALE_PUBLISH_COPY_AGE_MS} ago: that
   * one is deleted and a new one made. A copy this call made is deleted again
   * when preparing it fails; a copy another publish made is never touched.
   * @param userSub - caller's session subject, used to clear cached lists
   * @param accessToken - caller's bearer token
   * @param original - the application in the caller's own bucket
   * @param rewrite - returns the body to store in the copy, given the copy's current body
   * @throws {ApplicationBeingPublishedException} When another publish of the same application holds the copy
   * @throws Core's mapped error (an `HttpException`) when it refuses the copy or the write
   */
  async create(
    userSub: string,
    accessToken: string,
    original: DialApplicationResource,
    rewrite: (body: DialApplication) => Promise<DialApplication>,
  ): Promise<ApplicationPublishCopy> {
    const headers = getBearerAuthHeaders(accessToken);
    const copy = this.toCopy(original);
    const context = `copy application "applications/${original.bucket}/${original.path}" for publishing`;

    await this.copyOriginal(userSub, accessToken, original, copy, context);
    try {
      const { body, etag } = await this.applicationsService.readApplication(
        headers,
        copy.resource,
        context,
      );
      await this.applicationsService.writeApplication(
        headers,
        copy.resource,
        await rewrite(body),
        context,
        etag,
      );
    } catch (err) {
      await this.delete(userSub, accessToken, copy);
      throw err;
    }
    await this.applicationsService.invalidateAfterWrite(
      userSub,
      [copy.id],
      context,
    );
    return copy;
  }

  /**
   * Deletes a copy. A failed deletion is logged as a warning naming the copy
   * and never thrown: the publication it served has already succeeded or
   * failed on its own.
   * @param userSub - caller's session subject, used to clear cached lists
   * @param accessToken - caller's bearer token
   * @param copy - the copy {@link create} returned
   */
  async delete(
    userSub: string,
    accessToken: string,
    copy: ApplicationPublishCopy,
  ): Promise<void> {
    try {
      const { error, response } =
        await this.dialClient.client.deleteCustomApplication(
          copy.resource.bucket,
          copy.resource.path,
          { headers: getBearerAuthHeaders(accessToken) },
        );
      if (error != null && response.status !== 404) {
        throw new Error(`status ${response.status}`);
      }
      await this.applicationsService.invalidateAfterWrite(
        userSub,
        [copy.id],
        'delete the publish copy',
      );
    } catch (err) {
      this.logger.warn(
        `Could not delete the temporary publish copy "${copy.id}": ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
    }
  }

  private toCopy(original: DialApplicationResource): ApplicationPublishCopy {
    const leaf = getResourceLeaf(original.path);
    const folder = original.path.slice(0, original.path.length - leaf.length);
    const resource = {
      bucket: original.bucket,
      path: `${folder}${PUBLISH_STAGING_SEGMENT}/${leaf}`,
    };
    return { id: `applications/${resource.bucket}/${resource.path}`, resource };
  }

  private async copyOriginal(
    userSub: string,
    accessToken: string,
    original: DialApplicationResource,
    copy: ApplicationPublishCopy,
    context: string,
  ): Promise<void> {
    const transfer = () =>
      transferDialResource({
        client: this.dialClient.client,
        operation: 'copyResource',
        type: DialResourceType.Applications,
        headers: getBearerAuthHeaders(accessToken),
        source: original,
        destination: copy.resource,
        context,
        logger: this.logger,
      });

    try {
      await transfer();
    } catch (err) {
      if (!(err instanceof ConflictException)) throw err;
      const state = await this.inspectCopy(accessToken, copy);
      if (!state.exists) throw err;
      if (!state.isStale) throw new ApplicationBeingPublishedException();
      this.logger.warn(
        `Reclaiming a leftover temporary publish copy "${copy.id}"`,
      );
      await this.delete(userSub, accessToken, copy);
      try {
        await transfer();
      } catch (retryErr) {
        if (
          retryErr instanceof ConflictException &&
          (await this.inspectCopy(accessToken, copy)).exists
        ) {
          throw new ApplicationBeingPublishedException();
        }
        throw retryErr;
      }
    }
  }

  /**
   * Reads the copy's metadata once: whether it exists and, if so, whether it
   * was last modified more than {@link STALE_PUBLISH_COPY_AGE_MS} ago. A copy
   * whose age cannot be read counts as current, so a live publish is never torn
   * down. A copy that cannot be read at all counts as absent, so a `409` that
   * is not about the copy (Core refuses to copy a running application, for one)
   * is passed on and absorbed by the plain-publish fallback instead of being
   * reported as "already being published".
   * @param accessToken - caller's bearer token
   * @param copy - the copy to look up
   */
  private async inspectCopy(
    accessToken: string,
    copy: ApplicationPublishCopy,
  ): Promise<{ exists: boolean; isStale: boolean }> {
    try {
      const { data, response } =
        await this.dialClient.client.getApplicationMetadata(
          copy.resource.bucket,
          copy.resource.path,
          { headers: getBearerAuthHeaders(accessToken) },
        );
      if (response?.status !== 200) return { exists: false, isStale: false };
      const updatedAt =
        data != null && 'updatedAt' in data ? data.updatedAt : undefined;
      return {
        exists: true,
        isStale:
          updatedAt != null &&
          Date.now() - updatedAt > STALE_PUBLISH_COPY_AGE_MS,
      };
    } catch {
      return { exists: false, isStale: false };
    }
  }
}
