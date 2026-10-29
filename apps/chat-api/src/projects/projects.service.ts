import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  extractDialErrorMessage,
  handleDialSdkError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { PUBLIC_BUCKET } from '../constants/dial.constants';
import { DialClientService } from '../dial/dial-client.service';
import { UserConfigService } from '../user-config/user-config.service';
import { PROJECT_WRITE_ATTEMPTS } from './constants/project-context.constants';
import {
  type ProjectCreateInput,
  ProjectsCreateService,
  type UploadedContextFile,
} from './create/projects-create.service';
import type { CreateProjectResponseDto } from './dto/create-project-response.dto';
import type { ListProjectsResponseDto } from './dto/list-projects-response.dto';
import type { ProjectDetailsDto } from './dto/project-details.dto';
import { ProjectSource } from './dto/project-source.enum';
import type { ProjectDto } from './dto/project.dto';
import {
  type DialProjectMetadata,
  mapProjectMetadata,
  mapSharedProject,
} from './projects.mapper';
import {
  type ProjectSnapshot,
  ProjectsSnapshotService,
} from './snapshot/projects-snapshot.service';
import { ProjectCreateErrorCode } from './types/project-create-error-code.enum';
import {
  projectChanged,
  projectConflict,
  requireSingleIfMatch,
} from './utils/project-create-error.util';
import { type ParsedProjectId, parseProjectId } from './utils/project-id.util';

type DialProjectListing = DialProjectMetadata & {
  items?: DialProjectMetadata[];
};
type BucketSource = ProjectSource.Personal | ProjectSource.Organization;
type DialProjectItemMetadata = DialProjectMetadata & {
  author?: string;
  createdAt?: number;
  updatedAt?: number;
};

/** One source's projects, and whether the source answered in full. */
interface SourceListing {
  items: ProjectDto[];
  isComplete: boolean;
}

const LISTING_CONTEXT = 'projects.listProjects';
const READ_CONTEXT = 'projects.getProject';
const DELETE_CONTEXT = 'projects.deleteProject';
const DELETE_TIMEOUT_MS = 30_000;
/** Deadline shared by the metadata and archive reads of one project. */
const PROJECT_READ_TIMEOUT_MS = 30_000;
const CREATE_CONTEXT = 'projects.createProject';
/* Longer than the listing deadline: a create can carry 10 MiB of context. */
const PROJECT_CREATE_TIMEOUT_MS = 60_000;
const PROJECTS_URL_PREFIX = 'projects';
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

/** The listing's source rule, applied to one project's bucket. */
export const resolveProjectSource = (
  bucket: string,
  sessionBucket: string,
): ProjectSource => {
  if (bucket === sessionBucket) return ProjectSource.Personal;
  if (bucket === PUBLIC_BUCKET) return ProjectSource.Organization;
  return ProjectSource.Shared;
};

/** Parses an id the param DTO already validated; a miss is still a `404`. */
export const requireProjectId = (id: string): ParsedProjectId => {
  const parsed = parseProjectId(id);
  if (parsed == null) throw new NotFoundException('Project not found');
  return parsed;
};

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly createService: ProjectsCreateService,
    private readonly snapshotService: ProjectsSnapshotService,
    private readonly userConfigService: UserConfigService,
  ) {}

  /**
   * Deletes a project only if its content is still the version the caller
   * read: `If-Match` carries the `contentVersion` from `GET`, compared with a
   * fresh snapshot, so a project conversation written meanwhile does not
   * block the delete. The Core delete is conditioned on the snapshot's
   * aggregate ETag; its `412` (a write in between) re-reads and tries again,
   * up to `PROJECT_WRITE_ATTEMPTS` deletes, then `409 project-changed`. A
   * missing `If-Match`, `*` or a list of tags is refused before any Core
   * call, so this API never deletes unconditionally, and so is a project
   * outside the caller's own bucket (`403`), matching `canEdit`. The
   * project's conversations go with it. The caller's pin is then removed as
   * a best effort — the delete has already committed.
   */
  async deleteProject(
    id: string,
    ifMatch: string | undefined,
    sessionBucket: string,
    accessToken: string,
  ): Promise<void> {
    const parsed = requireProjectId(id);
    if (parsed.bucket !== sessionBucket) {
      throw new ForbiddenException('Only the owner can delete a project');
    }
    const expectedVersion = requireSingleIfMatch(ifMatch);
    const signal = AbortSignal.timeout(DELETE_TIMEOUT_MS);

    let isDeleted = false;
    for (
      let attempt = 0;
      attempt < PROJECT_WRITE_ATTEMPTS && !isDeleted;
      attempt++
    ) {
      const snapshot = await this.snapshotService.read(
        parsed.bucket,
        parsed.path,
        accessToken,
        sessionBucket,
        signal,
      );
      if (snapshot.contentVersion !== expectedVersion) throw projectChanged();
      isDeleted = await this.deleteFolder(
        parsed,
        snapshot.etag,
        sessionBucket,
        accessToken,
        signal,
      );
    }
    if (!isDeleted) throw projectChanged();

    this.logger.log('Project deleted');
    await this.removePinQuietly(parsed.id, accessToken, sessionBucket);
  }

  /** One conditional Core delete; resolves `false` on Core's `412`. */
  private async deleteFolder(
    parsed: ParsedProjectId,
    etag: string,
    sessionBucket: string,
    accessToken: string,
    signal: AbortSignal,
  ): Promise<boolean> {
    try {
      const { error, response } =
        await this.dialClient.client.deleteProjectFolder(
          parsed.bucket,
          encodeDialResourcePath(parsed.path),
          {
            headers: {
              ...getBearerAuthHeaders(accessToken),
              'If-Match': etag,
            },
            signal,
          },
        );

      if (error != null || response.status >= 400) {
        if (response.status === 412) return false;
        if (
          response.status === 404 ||
          (response.status === 403 && parsed.bucket === sessionBucket)
        ) {
          throw new NotFoundException('Project not found');
        }
        return handleDialSdkError(error, DELETE_CONTEXT, this.logger, response);
      }
      return true;
    } catch (err) {
      return handleDialSdkError(err, DELETE_CONTEXT, this.logger);
    }
  }

  /** Best-effort pin cleanup after a committed delete; a failure is logged, not thrown. */
  private async removePinQuietly(
    id: string,
    accessToken: string,
    sessionBucket: string,
  ): Promise<void> {
    try {
      await this.userConfigService.removeProjectPin(
        id,
        accessToken,
        sessionBucket,
      );
    } catch (err) {
      this.logger.warn(
        `Pin cleanup after a project delete failed (${err instanceof Error ? err.name : 'unknown error'})`,
      );
    }
  }

  /**
   * Reads one project: its item metadata (author, timestamps) and its
   * archive snapshot (manifest, context sizes, ETag), concurrently under
   * one deadline that a client disconnect (`signal`) also ends. When either
   * read fails the other is aborted, so a failed metadata read does not
   * leave the archive buffering. The name is the last path segment, as in
   * the listing; `canEdit` holds only in the caller's own bucket, because
   * project share links are view-only and public projects change only
   * through publication.
   */
  async getProject(
    id: string,
    sessionBucket: string,
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<ProjectDetailsDto> {
    const parsed = requireProjectId(id);
    const siblingFailure = new AbortController();
    const readSignal = AbortSignal.any([
      AbortSignal.timeout(PROJECT_READ_TIMEOUT_MS),
      siblingFailure.signal,
      ...(signal ? [signal] : []),
    ]);
    const abortSiblingOnFailure = async <T>(read: Promise<T>): Promise<T> => {
      try {
        return await read;
      } catch (err) {
        /* The failure itself is the abort reason: the sibling then rejects
         * with this already-mapped exception, which the error mapper
         * rethrows as-is instead of logging a spurious upstream failure. */
        siblingFailure.abort(err);
        throw err;
      }
    };
    const [metadata, snapshot] = await Promise.all([
      abortSiblingOnFailure(
        this.readProjectMetadata(
          parsed,
          sessionBucket,
          accessToken,
          readSignal,
        ),
      ),
      abortSiblingOnFailure(
        this.snapshotService.read(
          parsed.bucket,
          parsed.path,
          accessToken,
          sessionBucket,
          readSignal,
        ),
      ),
    ]);
    /* Debug only (LOG_LEVEL=debug): the item metadata exactly as Core sent it. */
    this.logger.debug(
      `DIAL Core project metadata: ${JSON.stringify(metadata)}`,
    );
    const source = resolveProjectSource(parsed.bucket, sessionBucket);

    return {
      id: parsed.id,
      name: parsed.name,
      bucket: parsed.bucket,
      path: parsed.path,
      parentPath: parsed.parentPath,
      source,
      author: metadata.author,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      ...this.describeSnapshot(snapshot),
      canEdit: source === ProjectSource.Personal,
    };
  }

  /** The manifest, context, version and conversation-count fields of a project's details. */
  private describeSnapshot(
    snapshot: ProjectSnapshot,
  ): Pick<
    ProjectDetailsDto,
    | 'description'
    | 'instructions'
    | 'contextFiles'
    | 'etag'
    | 'contentVersion'
    | 'conversationCount'
  > {
    return {
      description: snapshot.manifest?.description ?? '',
      instructions: snapshot.manifest?.instructions ?? '',
      contextFiles: snapshot.contextFiles.map(({ name, size }) => ({
        name,
        size,
      })),
      etag: snapshot.etag,
      contentVersion: snapshot.contentVersion,
      conversationCount: snapshot.conversationEntries.length,
    };
  }

  /**
   * One project's item metadata. A grouping folder is not a project, so a
   * `FOLDER` answer is a `404`, as is Core's `404` and its `403` mask of a
   * missing resource in the caller's own bucket.
   */
  private async readProjectMetadata(
    parsed: ParsedProjectId,
    sessionBucket: string,
    accessToken: string,
    signal: AbortSignal,
  ): Promise<DialProjectItemMetadata> {
    try {
      const { data, error, response } =
        await this.dialClient.client.listProjectMetadata(
          parsed.bucket,
          encodeDialResourcePath(parsed.path),
          { headers: getBearerAuthHeaders(accessToken), signal },
        );

      if (error != null || data == null) {
        if (
          response?.status === 404 ||
          (response?.status === 403 && parsed.bucket === sessionBucket)
        ) {
          throw new NotFoundException('Project not found');
        }
        return handleDialSdkError(error, READ_CONTEXT, this.logger, response);
      }
      if (data.nodeType !== 'ITEM') {
        throw new NotFoundException('Project not found');
      }
      return data as DialProjectItemMetadata;
    } catch (err) {
      return handleDialSdkError(err, READ_CONTEXT, this.logger);
    }
  }

  /**
   * Creates a project at the root of the caller's own bucket in one atomic,
   * create-only Core call. `ProjectsCreateService` validates every field and
   * part first, so a rejection never reaches Core. `If-None-Match: '*'` is
   * Core's create-only mechanism (verified for complex resources in
   * `openspec/changes/archive/2026-08-13-fix-skill-editor-core-contract/design.md`):
   * sending neither header is an unconditional upsert, despite the SDK's
   * comment. Core's `412` therefore means the name is taken. Logs carry only
   * the outcome, file count and byte total — never a name or any content.
   */
  async createProject(
    bucket: string,
    input: ProjectCreateInput,
    files: UploadedContextFile[],
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<CreateProjectResponseDto> {
    const { formData, fileCount, totalBytes } =
      this.createService.validateAndBuild(input, files);
    const timeoutSignal = AbortSignal.timeout(PROJECT_CREATE_TIMEOUT_MS);

    try {
      const { error, response } =
        await this.dialClient.client.uploadProjectFolder(
          bucket,
          encodeDialResourcePath(input.name),
          {
            headers: {
              ...getBearerAuthHeaders(accessToken),
              // Undeclared in the pinned SDK's operation type — the same
              // verified schema gap `SkillsUploadService.createSkill` casts.
              'If-None-Match': '*',
            } as Record<string, string>,
            body: formData as unknown as { file: string },
            signal: signal
              ? AbortSignal.any([signal, timeoutSignal])
              : timeoutSignal,
          },
        );

      if (error != null) {
        if (response.status === 412) {
          throw projectConflict(
            ProjectCreateErrorCode.NameTaken,
            'A project with this name already exists',
            'name',
          );
        }
        return mapDialHttpStatus(
          response.status,
          CREATE_CONTEXT,
          this.logger,
          undefined,
          extractDialErrorMessage(error),
        );
      }

      this.logger.log(
        `Project created (files=${fileCount}, bytes=${totalBytes})`,
      );
      return {
        id: `${PROJECTS_URL_PREFIX}/${bucket}/${input.name}`,
        name: input.name,
        bucket,
        path: input.name,
        etag: response.headers.get('etag') ?? undefined,
      };
    } catch (err) {
      if (err instanceof HttpException) {
        this.logger.warn(
          `Project create rejected (status=${err.getStatus()}, files=${fileCount}, bytes=${totalBytes})`,
        );
        throw err;
      }
      return handleDialSdkError(err, CREATE_CONTEXT, this.logger);
    }
  }

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
