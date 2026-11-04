import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { DialClientService } from '../../dial/dial-client.service';
import type {
  ProjectArtifactItemDto,
  ProjectArtifactListResponseDto,
} from '../dto/project-artifact-list-response.dto';
import type { ParsedProjectId } from '../utils/project-id.util';
import { PROJECT_ARTIFACTS_FOLDER } from '../utils/project-manifest.util';

const LIST_CONTEXT = 'projects.artifacts.list';
/* Core's largest page; a project holds at most 1,000 files. */
const CORE_PAGE_LIMIT = 1000;

/** One entry of Core's `listProjectFileMetadata` answer. */
interface CoreFileItem {
  name?: string;
  nodeType?: string;
  author?: string;
  updatedAt?: number;
}

interface CoreFileListing {
  items?: CoreFileItem[];
  nextToken?: string;
}

/* `openapi-fetch` resolves an empty-bodied error with `error: undefined`, so the status decides. */
const isFailed = (error: unknown, response: Response | undefined): boolean =>
  error != null || response == null || response.status >= 400;

const newestFirst = (
  a: ProjectArtifactItemDto,
  b: ProjectArtifactItemDto,
): number => {
  const byTime = (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  if (byTime !== 0) return byTime;
  if (a.name === b.name) return 0;
  return a.name < b.name ? -1 : 1;
};

const toItem = (
  item: CoreFileItem & { name: string },
): ProjectArtifactItemDto => ({
  name: item.name,
  ...(item.updatedAt != null ? { updatedAt: item.updatedAt } : {}),
  ...(item.author != null ? { author: item.author } : {}),
});

/**
 * Lists the files directly under a project's `artifacts/` folder, where the
 * agents of its chats save their outputs, newest first. The archive snapshot
 * carries no times, so the order comes from Core's file metadata
 * (`openspec/changes/archive/2026-11-02-add-project-view-outputs/design.md`
 * D1). Every item is returned: Core caps a project at 1,000 files. Logs carry
 * counts only, never names.
 */
@Injectable()
export class ProjectArtifactsListService {
  private readonly logger = new Logger(ProjectArtifactsListService.name);

  constructor(private readonly dialClient: DialClientService) {}

  /**
   * @param project - the project to list
   * @param accessToken - caller's bearer token; Core checks read access
   * @param callerBucket - caller's own bucket, where Core masks a missing project as `403`
   */
  async listArtifacts(
    project: ParsedProjectId,
    accessToken: string,
    callerBucket: string,
  ): Promise<ProjectArtifactListResponseDto> {
    const items: ProjectArtifactItemDto[] = [];
    let token: string | undefined;
    do {
      let listing: CoreFileListing;
      try {
        const { data, error, response } =
          await this.dialClient.client.listProjectFileMetadata(
            project.bucket,
            encodeDialResourcePath(project.path),
            `${PROJECT_ARTIFACTS_FOLDER}/`,
            {
              headers: getBearerAuthHeaders(accessToken),
              params: {
                query: {
                  limit: CORE_PAGE_LIMIT,
                  recursive: false,
                  ...(token ? { token } : {}),
                },
              },
            },
          );
        if (isFailed(error, response)) {
          /* A project without an `artifacts/` folder has no outputs yet. */
          if (response?.status === 404) break;
          if (response?.status === 403 && project.bucket === callerBucket) {
            throw new NotFoundException('Project not found');
          }
          return handleDialSdkError(error, LIST_CONTEXT, this.logger, response);
        }
        listing = (data ?? {}) as CoreFileListing;
      } catch (err) {
        return handleDialSdkError(err, LIST_CONTEXT, this.logger);
      }
      for (const item of listing.items ?? []) {
        if (item.nodeType === 'ITEM' && item.name) {
          items.push(toItem({ ...item, name: item.name }));
        }
      }
      token = listing.nextToken || undefined;
    } while (token);

    items.sort(newestFirst);
    this.logger.debug(`Listed project artifacts (total=${items.length})`);
    return { items };
  }
}
