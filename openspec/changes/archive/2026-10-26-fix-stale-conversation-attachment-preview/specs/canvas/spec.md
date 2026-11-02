# Spec Delta

## ADDED Requirements

### Requirement: The latest attachment click owns the canvas

An attachment preview SHALL write to the canvas only while it is the latest preview requested from any caller (conversation messages, the input tray, the sources panel, the file manager), including a preview that opens synchronously such as an image, and its requester is still mounted. A preview that a later one supersedes, or that finishes after its requester is gone, SHALL write nothing to the canvas and SHALL NOT close it. Where a click's "could not preview" fallback is a download or a new browser tab, a superseded click SHALL NOT run that fallback and SHALL NOT close the sources sidebar. Underlying content loading is not required to be cancelled.

#### Scenario: Only the last of several quick attachment clicks opens

- **WHEN** the user clicks a large attachment in a message and, before it has loaded, clicks a second attachment
- **THEN** the canvas shows the second attachment, even if the first finishes loading later

#### Scenario: A superseded sources-panel click does not download or open a tab

- **WHEN** the user clicks a source in the sources panel and, before it has loaded, clicks another attachment
- **THEN** the first click triggers no download, no new tab and does not close the sources sidebar

#### Scenario: A synchronous preview supersedes a pending one

- **WHEN** the user clicks a large PDF attachment and, before it has loaded, clicks an image attachment
- **THEN** the canvas keeps the image when the PDF finishes loading

#### Scenario: A click finishing after the page is gone opens nothing

- **WHEN** the user clicks an attachment and navigates away before it has loaded
- **THEN** the canvas is not opened when the content arrives

#### Scenario: Previews from different callers share one order

- **WHEN** the user clicks a large attachment in a message and, before it has loaded, clicks a source in the sources panel
- **THEN** only the source from the sources panel is shown
