## ADDED Requirements

### Requirement: General step fields
The Quick App editor's General step SHALL allow editing the application name, version, icon
URL, description, topics, and intro. The icon SHALL be entered as a plain URL text field. Name
SHALL be required and restricted to letters, digits, spaces, underscores, dots, and dashes.
Intro SHALL be a single-line text field limited to 90 characters and SHALL be optional.

#### Scenario: Edit general fields
- **WHEN** a user types a name, version, icon URL, description, intro, and adds topic tags
- **THEN** those values are held in component state without saving

#### Scenario: Name is required
- **WHEN** a user clears the name field and attempts to save
- **THEN** the system shows a required-field error for the name and blocks the save

#### Scenario: Intro exceeds the character limit
- **WHEN** a user enters an intro longer than 90 characters and attempts to save
- **THEN** the system shows a length-limit error on the intro field and blocks the save

#### Scenario: Intro is optional
- **WHEN** a user leaves the intro field empty and saves the Quick App
- **THEN** the save proceeds without an intro-related error

### Requirement: Create request forwards form fields
On save, the editor SHALL submit the General step field values — including `intro` when set —
to the create-application endpoint via the generated `@epam/chat-api-client`
`ApplicationsApi`, through the `apps/chat/src/server-api/applications.ts` wrapper.

#### Scenario: Save sends intro
- **WHEN** a user saves a new Quick App with a non-empty intro
- **THEN** the create request body includes `intro` with the entered value

#### Scenario: Save omits intro
- **WHEN** a user saves a new Quick App with an empty intro
- **THEN** the create request body does not include a truthy `intro` value
