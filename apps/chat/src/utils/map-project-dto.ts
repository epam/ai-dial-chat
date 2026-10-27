import {
  ProjectSource as ProjectSourceDto,
  type ProjectDto,
} from '@epam/ai-dial-chat-api-client';
import { type ProjectItem, ProjectSource } from '@epam/ai-dial-projects';

const PROJECT_SOURCES: Record<ProjectSourceDto, ProjectSource> = {
  [ProjectSourceDto.Personal]: ProjectSource.Personal,
  [ProjectSourceDto.Shared]: ProjectSource.Shared,
  [ProjectSourceDto.Organization]: ProjectSource.Organization,
};

/** Maps a BFF project source onto the Projects lib's source. */
export const mapProjectSource = (source: ProjectSourceDto): ProjectSource =>
  PROJECT_SOURCES[source];

/** Maps a BFF project to the card item the Projects lib renders; the date falls back to the creation time. */
export const mapProjectDtoToItem = (project: ProjectDto): ProjectItem => ({
  id: project.id,
  name: project.name,
  source: mapProjectSource(project.source),
  updatedAt: project.updatedAt ?? project.createdAt,
});
