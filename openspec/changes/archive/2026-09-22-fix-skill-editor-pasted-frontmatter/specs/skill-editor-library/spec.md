## ADDED Requirements

### Requirement: Host-observable field-value changes

`SkillEditorProps` SHALL accept an optional
`onValuesChange?: (values: SkillEditorValues) => void` callback. `SkillEditor` SHALL
invoke it with the complete current `SkillEditorValues` object whenever any of
`name`, `description`, or `instructions` changes, including when a change originates
from a paste into the Instructions Markdown editor. It SHALL NOT be invoked for
file-tree changes, which are already reported through `fileActions` and
`onDirtyChange`.

`SkillEditor` SHALL NOT invoke `onValuesChange` while seeding or re-seeding from
`initialValues` — seeding is not a user edit, and a host that validated the seeded
value would show an error the user did not cause.

This callback exists so a host can validate a field's content live and feed the result
back through the existing `errors` prop. The library SHALL derive no meaning from the
values it reports: it SHALL continue to treat `name`, `description`, and `instructions`
as opaque strings, SHALL NOT parse them, and SHALL NOT gain a dependency on `yaml` or
any other serialization package, preserving the "No host, REST, serialization, or i18n
dependency" requirement.

The prop is optional and additive: an existing consumer that omits it observes no
behavior change.

#### Scenario: Typing into a field reports the full value object

- **WHEN** a user types into the Description field
- **THEN** `onValuesChange` is called with an object carrying the current `name`, `description`, and `instructions`, with `description` reflecting the new text

#### Scenario: Pasting into Instructions reports the pasted value

- **WHEN** a user pastes multi-line text into the Instructions Markdown editor
- **THEN** `onValuesChange` is called with `instructions` equal to the editor's new full value

#### Scenario: Seeding does not report a change

- **WHEN** the host passes a new `initialValues` object identity and the form re-seeds
- **THEN** `onValuesChange` is not called

#### Scenario: Omitting the callback changes nothing

- **WHEN** a consumer renders `SkillEditor` without `onValuesChange`
- **THEN** the component behaves exactly as before, with no error and no extra render work

#### Scenario: The library still performs no serialization

- **WHEN** `libs/skill-editor/src/**` is searched for imports of `yaml` or `fflate`
- **THEN** none are found, and `libs/skill-editor/package.json` declares neither as a dependency or peer dependency
