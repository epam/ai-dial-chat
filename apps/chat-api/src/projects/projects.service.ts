import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { handleDialSdkError } from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { PUBLIC_BUCKET } from '../constants/dial.constants';
import { DialClientService } from '../dial/dial-client.service';
import type { ListProjectsResponseDto } from './dto/list-projects-response.dto';
import { ProjectSource } from './dto/project-source.enum';
import type { ProjectDto } from './dto/project.dto';
import {
  type DialProjectMetadata,
  mapProjectMetadata,
  mapSharedProject,
} from './projects.mapper';

type DialProjectListing = DialProjectMetadata & {
  items?: DialProjectMetadata[];
};
type BucketSource = ProjectSource.Personal | ProjectSource.Organization;

/** One source's projects, and whether the source answered in full. */
interface SourceListing {
  items: ProjectDto[];
  isComplete: boolean;
}

const LISTING_CONTEXT = 'projects.listProjects';
/** Deadline shared by every Core call of one listing request. */
const PROJECTS_LISTING_TIMEOUT_MS = 30_000;
const PROJECTS_PAGE_SIZE = 1000;
/** Bounds the Core pages one source may cost a single listing request. */
const MAX_UPSTREAM_PAGES_PER_SOURCE = 20;
/** Earlier sources win a duplicate id: an owned or public copy beats a share. */
const SOURCE_PRECEDENCE = [
  ProjectSource.Personal,
  ProjectSource.Organization,
  ProjectSource.Shared,
];

const isProject = (item: ProjectDto | null): item is ProjectDto => item != null;

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly dialClient: DialClientService) {}

  /**
   * Lists every project the caller can see: their own bucket, the public
   * (organization) bucket, and projects shared with them. One failing or
   * truncated source degrades the answer instead of failing it and is named
   * in `incompleteSources`; only when both bucket listings fail is the
   * personal listing's error surfaced. Every Core call shares one deadline,
   * so the whole listing is bounded by `PROJECTS_LISTING_TIMEOUT_MS`.
   */
  async listProjects(
    bucket: string,
    accessToken: string,
  ): Promise<ListProjectsResponseDto> {
    const signal = AbortSignal.timeout(PROJECTS_LISTING_TIMEOUT_MS);
    const [[personalResult, organizationResult], shared] = await Promise.all([
      Promise.allSettled([
        this.listBucketProjects(
          bucket,
          ProjectSource.Personal,
          accessToken,
          signal,
        ),
        this.listBucketProjects(
          PUBLIC_BUCKET,
          ProjectSource.Organization,
          accessToken,
          signal,
        ),
      ]),
      this.listSharedProjects(accessToken, signal),
    ]);

    if (
      personalResult.status === 'rejected' &&
      organizationResult.status === 'rejected'
    ) {
      throw personalResult.reason;
    }

    const bySource: Record<ProjectSource, SourceListing> = {
      [ProjectSource.Personal]: this.settleSource(
        personalResult,
        ProjectSource.Personal,
      ),
      [ProjectSource.Organization]: this.settleSource(
        organizationResult,
        ProjectSource.Organization,
      ),
      [ProjectSource.Shared]: shared,
    };

    const items = new Map<string, ProjectDto>();
    for (const source of SOURCE_PRECEDENCE) {
      for (const project of bySource[source].items) {
        if (!items.has(project.id)) items.set(project.id, project);
      }
    }

    return {
      items: [...items.values()],
      incompleteSources: SOURCE_PRECEDENCE.filter(
        (source) => !bySource[source].isComplete,
      ),
    };
  }

  /** Unwraps a settled bucket listing; a rejected one counts as an incomplete, empty source. */
  private settleSource(
    result: PromiseSettledResult<SourceListing>,
    source: BucketSource,
  ): SourceListing {
    if (result.status === 'fulfilled') return result.value;
    this.logger.warn(`Project listing failed for source=${source}`);
    return { items: [], isComplete: false };
  }

  /**
   * Follows Core's cursor through one bucket's recursive project listing.
   * A repeated cursor is an invalid upstream listing (502); reaching the
   * page cap returns what was collected, marked incomplete. Logs name only
   * the source kind and page count — never the cursor or the bucket.
   */
  private async listBucketProjects(
    bucket: string,
    source: BucketSource,
    accessToken: string,
    signal: AbortSignal,
  ): Promise<SourceListing> {
    const items: ProjectDto[] = [];
    const visitedTokens = new Set<string>();
    let token: string | undefined;

    for (let page = 0; page < MAX_UPSTREAM_PAGES_PER_SOURCE; page += 1) {
      const listing = await this.listProjectPage(
        bucket,
        token,
        accessToken,
        signal,
      );
      if (listing == null) return { items, isComplete: true };

      items.push(
        ...(listing.items ?? [])
          .map((item) => mapProjectMetadata(item, source))
          .filter(isProject),
      );

      const nextToken = listing.nextToken;
      if (nextToken == null) return { items, isComplete: true };
      if (visitedTokens.has(nextToken)) {
        this.logger.error(
          `DIAL Core returned a repeated project page token (source=${source}, pages=${page + 1})`,
        );
        throw new BadGatewayException(
          'DIAL Core returned an invalid project listing page',
        );
      }
      visitedTokens.add(nextToken);
      token = nextToken;
    }

    this.logger.warn(
      `Project listing stopped at the page cap (source=${source}, pages=${MAX_UPSTREAM_PAGES_PER_SOURCE})`,
    );
    return { items, isComplete: false };
  }

  /**
   * One upstream `listProjectMetadata` page. A 404 on the root page means
   * the bucket has no projects folder yet, so it answers `null` (empty)
   * instead of failing; a 404 on a later page still fails the source.
   */
  private async listProjectPage(
    bucket: string,
    token: string | undefined,
    accessToken: string,
    signal: AbortSignal,
  ): Promise<DialProjectListing | null> {
    try {
      const { data, error, response } =
        await this.dialClient.client.listProjectMetadata(
          bucket,
          encodeDialResourcePath(''),
          {
            headers: getBearerAuthHeaders(accessToken),
            params: {
              query: { token, limit: PROJECTS_PAGE_SIZE, recursive: true },
            },
            signal,
          },
        );

      if (error != null || data == null) {
        if (token == null && response?.status === 404) return null;
        return handleDialSdkError(
          error,
          LISTING_CONTEXT,
          this.logger,
          response,
        );
      }

      return data as DialProjectListing;
    } catch (err) {
      return handleDialSdkError(err, LISTING_CONTEXT, this.logger);
    }
  }

  /** Lists projects shared with the caller; a failure yields an incomplete, empty source instead of failing the request. */
  private async listSharedProjects(
    accessToken: string,
    signal: AbortSignal,
  ): Promise<SourceListing> {
    try {
      const { data, error, response } =
        await this.dialClient.client.getSharedResources({
          headers: getBearerAuthHeaders(accessToken),
          body: { resourceTypes: ['PROJECT'], with: 'me' },
          signal,
        });
      if (error != null || data == null) {
        this.logger.warn(
          `getSharedResources (PROJECT) returned an error (status=${response?.status ?? 'unknown'})`,
        );
        return { items: [], isComplete: false };
      }

      return {
        items: (data.resources ?? []).map(mapSharedProject).filter(isProject),
        isComplete: true,
      };
    } catch (err) {
      this.logger.warn(
        `getSharedResources (PROJECT) failed (${err instanceof Error ? err.name : 'unknown error'})`,
      );
      return { items: [], isComplete: false };
    }
  }
}
