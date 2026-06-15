## ADDED Requirements

### Requirement: Language submenu item

A **Language** item SHALL appear in the User Menu dropdown immediately below the first divider (between the identity header and the Theme item). It SHALL render with a right-arrow indicator (via `DropdownItem.children`) that reveals a submenu on hover containing one option per supported language. The item label SHALL be `t('settings.language')`. The item icon SHALL be `IconLanguage` (16 px, `@tabler/icons-react`).

i18n keys: `settings.language`

#### Scenario: Language submenu opens on hover
- **WHEN** the user hovers over the Language item in the User Menu
- **THEN** a submenu appears listing all supported language options

#### Scenario: Language item appears between identity header and Theme item
- **WHEN** the User Menu dropdown is open
- **THEN** the menu order is: identity header → divider → Language → Theme → Keyboard Shortcuts → divider → Log out

#### Scenario: Language item is hidden when only one language is available
- **WHEN** only one language is registered in the i18n config
- **THEN** the Language item does NOT appear in the User Menu dropdown
