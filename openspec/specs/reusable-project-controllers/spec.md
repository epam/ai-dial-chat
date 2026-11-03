# Reusable project controllers Specification

## Purpose

Defines the reusable project controllers that `@epam/ai-dial-chat-hooks` offers to any DIAL chat host: what each one does, what the host injects and keeps, and the guarantee that adopting them changes no visible behaviour of the Projects pages.

## Requirements

### Requirement: Public ownership and host isolation

`libs/chat-hooks` SHALL expose the project preview helpers and controller, the project form draft, the new-chat flow, the conversation data-source interfaces with the project factory, and the publish-history controller through the root entry and the existing `./project`, `./conversation` and `./catalog` entries, with their option and result types. The code SHALL be non-rendering and SHALL NOT import app contexts, routing, auth or session state, environment variables, feature flags, translation engines, storage, feature-library hooks or components, and SHALL NOT construct a REST client or know an `/api` path. Hosts SHALL supply requests through an already configured `ProjectsApiClient` (or a narrower structural subset of it), URL and route builders, CSRF accessors, canvas callbacks, labels and notifications. No entry point SHALL gain a peer dependency.

No backend endpoint, generated-client change, feature flag, user-visible string, telemetry event or persistent cache SHALL be introduced. Direction, keyboard and screen-reader behaviour of every page SHALL stay as specified by their own capabilities.

#### Scenario: A host without the app's providers uses a controller

- **WHEN** a host renders a project controller with only structural data and callbacks, outside any `apps/chat` provider
- **THEN** it runs without app imports, implicit client configuration, route knowledge or storage keys

#### Scenario: Entry points keep their peers

- **WHEN** the packed `@epam/ai-dial-chat-hooks` is built and each entry is imported with only that entry's documented peers installed
- **THEN** every new export resolves and no entry's peer list has changed

### Requirement: Project file preview helpers

The library SHALL provide pure helpers that build the canvas key of a project file as `{scope}::{cardId}` and read a card id back from a key only when the scope matches; the card id of an output as `artifacts/{name}` and the output name back from such an id; and the attachments the canvas opens: a file added in the current session is its own attachment (it carries the `File`), a stored context file and an output are built from their project with a URL that is the locator returned by a host-supplied locator builder. The library SHALL NOT build the locator or resolve it to a request; the locator scheme and its mapping to the project file endpoints stay with the host (`apps/chat/src/utils/dial-file.ts`). A stored file with no project to read it from SHALL yield no attachment.

#### Scenario: Keys are scoped

- **WHEN** the key of `notes.txt` is built for project A and read back with project B's scope
- **THEN** nothing is returned, and reading it with project A's scope returns the card id

#### Scenario: Output ids never equal context ids

- **WHEN** an output and a context file are both called `notes.md`
- **THEN** the output card id is `artifacts/notes.md`, the context card id is `notes.md`, and only the output id reads back as an output name

#### Scenario: Locator comes from the host

- **WHEN** a stored file's attachment is built with a locator builder
- **THEN** the attachment's `url` is exactly what the builder returned for the project id and file name, and its type comes from the file's content type

### Requirement: Project file preview controller

The library SHALL provide one controller that opens a project file in the host's attachment canvas, shared by the New project, Edit project and project view pages. It SHALL NOT call a canvas hook: the host passes the current canvas attachment id, a function that opens an attachment under a key with a commit guard, a function that closes the canvas, a function that starts a guarded request, and callbacks that resolve a card id (and an output name) to an attachment. The controller SHALL derive the selected card from the canvas attachment id and the page scope; activate a card by opening it; close the canvas when the activated card is already open; ignore a card that resolves to no attachment; and, when the page's file list changes, close the canvas only if the open file is no longer in it. Its callbacks SHALL keep their identity while their inputs are unchanged. A response belonging to a request the user has since superseded SHALL not be shown, through the host's commit guard.

#### Scenario: Open, switch and close

- **GIVEN** no file is open
- **WHEN** the user activates `tickets.csv`, then `report.pdf`, then `report.pdf` again
- **THEN** the canvas opens `tickets.csv`, then `report.pdf` under its own key, then closes, and the selected card follows each step

#### Scenario: Removing the open file closes the canvas

- **GIVEN** `tickets.csv` is open
- **WHEN** the page's file list changes to one without it
- **THEN** the canvas closes; and when only another file was removed the canvas stays open

#### Scenario: Output cards

- **WHEN** the user activates an output named `deck.pptx`
- **THEN** it opens under the key built from the output card id, only the output card is selected, and no context card with the same name is

#### Scenario: Unknown card

- **WHEN** a card id resolves to no attachment
- **THEN** nothing is opened and the canvas is left as it was

### Requirement: Project form draft

The library SHALL provide one draft controller for the New project and Edit project forms. It SHALL own the values (name, instructions), the context files, the field errors and the handlers the form needs; clear a field's error when that field changes and the files error when the files change; and report whether the draft holds edits that leaving would lose. In create mode the draft is dirty when any value is non-empty or any file is staged. In edit mode it SHALL seed itself from the loaded project once per `contentVersion` (a reload after a conflict replaces the draft, a re-render never does), expose the names of stored files the user removed and the files added in the session, and be dirty only after seeding and only when a value differs from the project or a file was removed or added. The draft SHALL NOT own navigation, the unsaved-changes guard, notifications or the canvas.

#### Scenario: Create draft dirtiness

- **WHEN** the New project form is untouched, then the user types a name
- **THEN** the draft is clean, then dirty

#### Scenario: Edit draft seeds once per version

- **GIVEN** a project loaded at content version `v1`
- **WHEN** the user edits the name and the component re-renders with the same project
- **THEN** the edit is kept
- **AND WHEN** the project is reloaded at content version `v2`
- **THEN** the draft is replaced by the reloaded project and its errors are cleared

#### Scenario: Edit draft tracks file changes

- **GIVEN** a seeded draft of a project with stored `a.csv`
- **WHEN** the user removes `a.csv` and adds `b.pdf` from the device
- **THEN** the removed names are `a.csv`, the new files contain `b.pdf`, and the draft is dirty

#### Scenario: Not dirty before seeding

- **WHEN** the edit draft has no loaded project
- **THEN** it is not dirty and exposes no removed or new files

### Requirement: Create a project chat from its first message

The library SHALL provide a flow that creates a project conversation from the first message with the deployment, attachments, tool configuration and skills the composer holds, then saves the composer's system prompt, temperature and response format onto it, then hands the saved conversation to the host's `onCreated` callback in every case, including when the save fails, after which the save failure is rethrown. A failed create SHALL reject without calling `onCreated`. A classifier SHALL report a rejected create as `storage-full` when the BFF code is `ProjectStorageFull` and as `failed` otherwise, with the trace id. Skill-mention bookkeeping, toasts, the model selection and navigation SHALL stay with the host.

#### Scenario: Create then save then open

- **WHEN** the first message is sent from the project's composer
- **THEN** the chat is created, its settings are saved, and `onCreated` receives the conversation with those settings

#### Scenario: Save fails after create

- **WHEN** the create succeeds and saving the settings rejects
- **THEN** `onCreated` still receives the created conversation, and the rejection is rethrown afterwards

#### Scenario: Storage full

- **WHEN** the create rejects with `ProjectStorageFull`
- **THEN** `onCreated` is not called and the classifier reports `storage-full`

### Requirement: Conversation data source contract and factories

The library SHALL export the `ConversationDataSource` and `ConversationListSync` contracts that a conversation page reads and writes through, `NO_CONVERSATION_LIST_SYNC` and a factory for the project source; the regular source's wiring stays with the host. The contracts SHALL keep their present members; `notFoundMessageKey` SHALL be a plain string that the host resolves. The project source SHALL read, save, delete, stream and attach through the supplied project requests under the supplied stream base path and CSRF accessors; normalise a stream path to a project conversation id by prefixing `projects/` only when it is missing; open read-only exactly when the caller cannot edit; offer no Duplicate; exit to the supplied project route; mark an open chat viewed through the supplied writer, and drop a mark still waiting when a generation starts; report no sidebar list side effects; and, because Core resource subscriptions inside a project are unavailable, emit a synthetic update event every five seconds on its watch stream until aborted and re-read the conversation up to five times, two seconds apart, to pick up the title its first reply produces. Route builders, the CSRF accessors, the stream base path, the viewed-mark writer and the not-found key SHALL be supplied by the host (`apps/chat/src/utils/project-conversation-data-source.ts`).

#### Scenario: Normalised ids

- **WHEN** the project source saves with the path `a1b2c3/q4/conversations/x` and with `projects/a1b2c3/q4/conversations/x`
- **THEN** both save the conversation `projects/a1b2c3/q4/conversations/x`

#### Scenario: Read-only follows ownership

- **WHEN** the project source is created for a project the caller cannot edit
- **THEN** every conversation opens read-only, and a project the caller can edit opens editable

#### Scenario: Watch stream polls until aborted

- **WHEN** the watch stream is read and the poll interval elapses
- **THEN** one update frame is emitted per interval, and the stream closes when its signal aborts

#### Scenario: Title re-read stops on change

- **WHEN** the conversation's name differs from the previous name on the second re-read
- **THEN** the title callback receives the new name and no further re-read happens; a cleanup call cancels pending re-reads

#### Scenario: Viewed marks

- **WHEN** a generation starts for a chat whose viewed mark is still queued
- **THEN** the queued mark is dropped; and opening a chat enqueues one mark and ignores its failure

### Requirement: Project publish history controller

The library SHALL provide a controller that, each time the publish panel opens, reads the project's publication history through a host-supplied function, maps it to the panel's history entries, and shows an empty history when the read fails; a read in flight SHALL be discarded when the panel closes or the project changes. The host SHALL keep the request and the entity type.

#### Scenario: Re-read on every open

- **WHEN** the panel opens, closes and opens again
- **THEN** history is read on each open, and a result that arrives after the panel closed is ignored

#### Scenario: Failed read

- **WHEN** the history request rejects
- **THEN** the history is empty and no error is thrown to the panel

### Requirement: File-manager picks reuse the shared picker

A project form's "File manager" source SHALL use the shared promise-based file-system picker (`useSkillFileSystemPicker`, exported from `./skill-editor` and the root) with a host `materializeFile` that downloads the file into a `File` and a host `onError` that shows the error toast. The behaviour the form relies on SHALL be unchanged: only files (not folders) are staged, in selection order; cancelling or closing resolves the pick as cancelled; a failed download cancels the pick and reports the error once; a pending pick when the page unmounts resolves as cancelled; and a download that finishes after a newer pick started cannot settle it.

#### Scenario: Picked files are staged in order

- **WHEN** two files and a folder are picked
- **THEN** the form receives the two downloaded `File`s in selection order and the folder is ignored

#### Scenario: Failure cancels the pick

- **WHEN** one of the downloads fails
- **THEN** the pick resolves as cancelled and the error toast is shown once

### Requirement: Hosts adopt the controllers through thin adapters

`apps/chat` SHALL use the library implementations for every extracted behaviour; the modules it keeps for them (`apps/chat/src/utils/project-file-preview.ts`, `apps/chat/src/utils/project-conversation-data-source.ts`, `apps/chat/src/hooks/projects/useProjectFileManagerPicker.ts`) SHALL contain only host binding: the locator builders, route builders, CSRF accessors, translated labels and error toasts, and notification and navigation calls. The visible behaviour of the Projects pages, the project chat page and the project publish panel SHALL be identical before and after adoption. Specs that cite a moved or renamed module SHALL be updated to the new owner in the same change.

#### Scenario: Existing page behaviour is unchanged

- **WHEN** the existing page and component specs for the New project, Edit project, project view, project chat and project publish surfaces run against the adapters
- **THEN** they pass without a change in what they assert

#### Scenario: Specs name the current owner

- **WHEN** `npm run validate:specs` runs
- **THEN** every repo path cited by the project specs exists
