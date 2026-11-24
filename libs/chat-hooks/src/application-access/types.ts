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

/** Where an application's stored Access list stands. */
export enum ApplicationAccessLoadStatus {
  Loading = 'loading',
  Loaded = 'loaded',
  Failed = 'failed',
}

/** How an Access save ended. */
export enum ApplicationAccessSaveOutcome {
  /** The list was sent and is now the baseline. */
  Saved = 'saved',
  /** Nothing was sent: the section is off, untouched, or there is nothing to send. */
  Unchanged = 'unchanged',
  /** DIAL Core refused a non-administrator's change; the draft is kept. */
  Refused = 'refused',
  /** Any other failure; the draft is kept. */
  Failed = 'failed',
}
