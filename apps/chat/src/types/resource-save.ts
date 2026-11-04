/** The roots of the Save panel's destination tree. */
export enum SaveDestinationRoot {
  /** The user's own folders for the resource type. */
  Personal = 'personal',
  /** The Organization/public bucket; saving here also sends a publish request. */
  Organization = 'organization',
}

/** How a save that reached at least its first step ended. */
export enum ResourceSaveOutcome {
  /** Every step succeeded. */
  Saved = 'saved',
  /** The save succeeded but moving into the chosen Personal folder failed. */
  SavedButMoveFailed = 'savedButMoveFailed',
  /** The save succeeded but the publish request failed. */
  SavedButPublishFailed = 'savedButPublishFailed',
}
