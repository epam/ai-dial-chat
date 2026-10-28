/** Where a project comes from, relative to the viewing user. */
export enum ProjectSource {
  /** The project lives in the user's own storage. */
  Personal = 'personal',
  /** Another user shared the project with this user. */
  Shared = 'shared',
  /** The project is published to the whole organization. */
  Organization = 'organization',
}
