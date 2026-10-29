import {
  ProjectSource as ProjectSourceDto,
  type ProjectDetailsDto,
  type ProjectDto,
} from '@epam/ai-dial-chat-api-client';
import {
  getAttachmentTypeFromMime,
  inferMimeTypeFromPath,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import {
  type ProjectItem,
  ProjectSource,
  type ProjectViewModel,
  type StoredProjectContextFile,
} from '@epam/ai-dial-projects';

/* Left empty rather than `application/octet-stream` when the name's
 * extension has no known MIME type (e.g. `.xlsx`): the attachment card derives
 * its extension label from the content type first, so octet-stream would show
 * every such file as `.bin` instead of its own extension. */
const UNKNOWN_CONTENT_TYPE = '';

const PROJECT_SOURCES: Record<ProjectSourceDto, ProjectSource> = {
  [ProjectSourceDto.Personal]: ProjectSource.Personal,
  [ProjectSourceDto.Shared]: ProjectSource.Shared,
  [ProjectSourceDto.Organization]: ProjectSource.Organization,
};

/** Maps a BFF project source onto the Projects lib's source. */
export const mapProjectSource = (source: ProjectSourceDto): ProjectSource =>
  PROJECT_SOURCES[source];

/** Maps a BFF project to the card item the Projects lib renders; the sort date falls back to the creation time. */
export const mapProjectDtoToItem = (project: ProjectDto): ProjectItem => ({
  id: project.id,
  name: project.name,
  source: mapProjectSource(project.source),
  parentPath: project.parentPath,
  updatedAt: project.updatedAt ?? project.createdAt,
});

/** Maps a project's BFF details to the content the project view renders; content types come from the file names. */
export const mapProjectDetailsToViewModel = (
  project: ProjectDetailsDto,
): ProjectViewModel => ({
  name: project.name,
  description: project.description,
  instructions: project.instructions,
  contextFiles: project.contextFiles.map(({ name }) => ({
    name,
    contentType: inferMimeTypeFromPath(name) ?? UNKNOWN_CONTENT_TYPE,
  })),
});

/** Maps a project's stored context files to the cards the project form renders; ids are `stored:{name}`. */
export const mapStoredContextFiles = (
  project: ProjectDetailsDto,
): StoredProjectContextFile[] =>
  project.contextFiles.map(({ name, size }) => {
    const contentType = inferMimeTypeFromPath(name) ?? UNKNOWN_CONTENT_TYPE;
    return {
      id: `stored:${name}`,
      name,
      size,
      contentType,
      type: getAttachmentTypeFromMime(contentType),
      status: RequestStatus.Idle,
      isStored: true,
    };
  });
