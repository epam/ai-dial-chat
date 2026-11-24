/**
 * Resource types an application's Access section can configure. The values are
 * the DIAL Core resource type segments that open a dependency URL.
 */
export enum ApplicationAccessContentType {
  Files = 'files',
  Projects = 'projects',
  Skills = 'skills',
  Prompts = 'prompts',
  Conversations = 'conversations',
  Applications = 'applications',
  Toolsets = 'toolsets',
}
