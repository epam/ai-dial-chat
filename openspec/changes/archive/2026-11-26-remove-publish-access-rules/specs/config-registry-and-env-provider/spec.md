## REMOVED Requirements

### Requirement: Registry declares the publish.publicationFilterSources key

**Reason**: Publication access rules are removed from DIAL Chat (change `remove-publish-access-rules`). The source list only fed the rules editor's source picker.

**Migration**: `PUBLICATION_FILTER_SOURCES` and the `publish.publicationFilterSources` registry entry are deleted; a deployment that still sets the variable has it ignored.
