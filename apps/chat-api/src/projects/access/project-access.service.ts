import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { DialClientService } from '../../dial/dial-client.service';
import { ProjectSource } from '../dto/project-source.enum';
import {
  PROJECT_WRITE_PERMISSION,
  type ProjectAccess,
  resolveProjectSource,
  resolveSharedProjectPermissions,
} from '../utils/project-access.util';
import type { ParsedProjectId } from '../utils/project-id.util';

const RESOLVE_ACCESS_CONTEXT = 'projects.resolveAccess';
/*
 * Every lookup's own deadline, the same bound as the listing's call. The
 * conversation writes and completions pass no signal of their own, and the
 * completion check runs before the generation's preparation deadline starts.
 */
const RESOLVE_ACCESS_TIMEOUT_MS = 30_000;

const OWNER_ACCESS: ProjectAccess = { canEdit: true, canManage: true };
const NO_WRITE_ACCESS: ProjectAccess = { canEdit: false, canManage: false };

/**
 * The one place that decides what a caller may do with a project. The owner
 * may do everything. An organization project changes only through
 * publication. A share recipient may edit the content and write the chats
 * when DIAL Core lists the project (or a folder above it) as shared with
 * them with `WRITE`; rename, delete, share and publish stay owner-only.
 * Core puts no permissions on a project's item metadata, so the shared case
 * reads them from `getSharedResources({ with: 'me' })`, the call the
 * listing already makes. There is no cache, so a revoke applies on the
 * recipient's next request. A failed or timed-out lookup rejects with the
 * mapped upstream error, never `403`: a Core outage is not missing access.
 */
@Injectable()
export class ProjectAccessService {
  private readonly logger = new Logger(ProjectAccessService.name);

  constructor(private readonly dialClient: DialClientService) {}

  async resolveAccess(
    project: ParsedProjectId,
    sessionBucket: string,
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<ProjectAccess> {
    const source = resolveProjectSource(project.bucket, sessionBucket);
    if (source === ProjectSource.Personal) return OWNER_ACCESS;
    if (source === ProjectSource.Organization) return NO_WRITE_ACCESS;

    const permissions = await this.readSharedPermissions(
      project.id,
      accessToken,
      signal,
    );
    return {
      canEdit: permissions.has(PROJECT_WRITE_PERMISSION),
      canManage: false,
    };
  }

  /** `403` unless the caller may write the project's content and conversations. */
  async assertCanWrite(
    project: ParsedProjectId,
    sessionBucket: string,
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const { canEdit } = await this.resolveAccess(
      project,
      sessionBucket,
      accessToken,
      signal,
    );
    if (!canEdit) {
      throw new ForbiddenException('You cannot write to this project');
    }
  }

  /** `403` unless the caller owns the project; needs no Core call. */
  assertCanManage(project: ParsedProjectId, sessionBucket: string): void {
    if (
      resolveProjectSource(project.bucket, sessionBucket) !==
      ProjectSource.Personal
    ) {
      throw new ForbiddenException('Only the owner can manage this project');
    }
  }

  private async readSharedPermissions(
    projectId: string,
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<ReadonlySet<string>> {
    const lookupSignal = AbortSignal.any([
      AbortSignal.timeout(RESOLVE_ACCESS_TIMEOUT_MS),
      ...(signal ? [signal] : []),
    ]);
    try {
      const { data, error, response } =
        await this.dialClient.client.getSharedResources({
          headers: getBearerAuthHeaders(accessToken),
          body: { resourceTypes: ['PROJECT'], with: 'me' },
          signal: lookupSignal,
        });
      if (error != null || data == null) {
        return handleDialSdkError(
          error,
          RESOLVE_ACCESS_CONTEXT,
          this.logger,
          response,
        );
      }
      return resolveSharedProjectPermissions(data.resources ?? [], projectId);
    } catch (err) {
      return handleDialSdkError(err, RESOLVE_ACCESS_CONTEXT, this.logger);
    }
  }
}
