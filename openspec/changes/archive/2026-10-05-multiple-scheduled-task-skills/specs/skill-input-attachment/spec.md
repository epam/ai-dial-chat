## MODIFIED Requirements

### Requirement: Controlled skill field is reusable outside chat inputs

`@epam/ai-dial-skills` SHALL export the array-only `SkillSelectorField` and its props with controlled `value: string[]`, `onChange(value: string[])`, optional resolved `displayNames`, host-supplied `skills`, `isSkillsSupported`, disabled/error state, and injected labels. It SHALL render the UI kit's multiple `Select` with searchable checkbox options and built-in removable tags, and SHALL NOT expose a parallel single-value component or custom picker implementation. It SHALL own only Select open/search state and never import application providers or construct network requests. Saved references missing from the supplied skills SHALL remain visible through their resolved display name or raw URL fallback.

The Select SHALL own its visible label and error rendering. Until the UI kit exposes the combobox's ARIA attributes directly, the wrapper SHALL bridge the effective description and invalid state onto the rendered combobox. An unsupported empty field SHALL be disabled and expose the reason as its caption; when saved references exist, opening and adding SHALL remain disabled while tag removal remains available. Full submission disablement SHALL make all descendant actions inert.

`@epam/ai-dial-chat-shared` SHALL export a pure `isSkillSelectionUnsupported(skillUrl, isSkillsSupported)` predicate; the controlled field, chat overlay hook, and scheduler validator SHALL use it. The predicate SHALL depend on reference presence and strict support, not resolved metadata or feature flags. The chat hook SHALL apply its existing enabled-flow gate around the result. Existing chat-overlay API signatures SHALL remain compatible.

#### Scenario: Controlled external hydration

- **WHEN** a host replaces the selected array while one or more references are absent from the supplied skills
- **THEN** every selected value follows the new prop immediately and remains visible through its display-name or URL fallback

#### Scenario: Choose from the full skill list

- **WHEN** the supported field is activated
- **THEN** the UI-kit multiple Select opens a searchable checkbox list containing every host-supplied skill, without favorites filtering or a Browse catalog action
- **AND** search matches use the shared `Highlight` component and the UI kit announces empty results

#### Scenario: Clear without opening the picker

- **WHEN** a selected tag's remove action is activated
- **THEN** `onChange` receives the remaining ordered references without opening the Select

#### Scenario: Mobile picker presentation

- **WHEN** the field is rendered on mobile or tablet
- **THEN** the responsive UI-kit Select popover remains within the viewport and exposes the same keyboard selection and removal behavior

#### Scenario: Unsupported reference remains removable

- **WHEN** one or more selected references have no supplied option and support is false
- **THEN** the field reports the unsupported state, displays every reference, prevents opening or adding, and still supports removal unless the entire field is disabled

#### Scenario: Keyboard and search behavior is retained

- **WHEN** a keyboard user opens and filters the supplied skills
- **THEN** matched text uses the shared `Highlight`, option activation updates the full array once, and tag removal updates it with only that reference removed
