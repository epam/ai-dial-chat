/** A field of the shared Metadata field set; an editor lists the ones its entity type has. */
export enum MetadataField {
  /** The avatar preview and "Add avatar" control. */
  Avatar = 'avatar',
  /** The required display name. */
  Name = 'name',
  /** The version string, rendered beside Name. */
  Version = 'version',
  /** The long-form description. */
  Description = 'description',
  /** The additional-locale summary row and popup. */
  Locales = 'locales',
  /** The free-entry tags. */
  Tags = 'tags',
}

/** Every Metadata field, in render order — the default when an editor does not narrow the set. */
export const ALL_METADATA_FIELDS: readonly MetadataField[] = [
  MetadataField.Avatar,
  MetadataField.Name,
  MetadataField.Version,
  MetadataField.Description,
  MetadataField.Locales,
  MetadataField.Tags,
];
