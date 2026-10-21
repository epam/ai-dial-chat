# Spec Delta

## ADDED Requirements

### Requirement: Unpublish request also removes the published attachment files

`POST /api/v1/conversations/unpublish` SHALL add a `DELETE` resource for every file found under the conversation's published attachment namespace (see `conversation-published-attachments`) to the removal request, after the conversation `DELETE` resource. Each file `targetUrl` SHALL be taken from the live listing, not recomputed from the conversation, so only files that exist are named (Core rejects a `DELETE` of a target that does not exist). `sourceUrl`, authorization, error mapping, request and response shapes and cache invalidation SHALL be unchanged.

#### Scenario: Removal request contains the files

- **GIVEN** the published namespace of the conversation holds `docs/a.pdf` and `docs/sub/b.pdf`
- **WHEN** the conversation is unpublished
- **THEN** the `createPublication` body contains `DELETE` resources for the conversation and for both files

#### Scenario: Listing the namespace fails

- **WHEN** listing the published namespace fails
- **THEN** the endpoint maps the error through the existing DIAL error mapper and no removal request is created
