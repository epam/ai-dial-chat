## MODIFIED Requirements

### Requirement: Conversation name validation and sanitization utilities live in `chat-shared`

The conversation name input SHALL enforce the following naming conventions at the point of input, with no error message shown for character stripping — invalid content is silently excluded:

- The following characters are **prohibited** and must be stripped as the user types: tab (`\t`), `"`, `:`, `;`, `/`, `\`, `,`, `=`, `{`, `}`, `%`, `&`.
- Trailing dots (`.`) are **automatically removed** from the value before it is passed to `onSave`. Dots at the start of or inside the name are preserved.

Implementation:
- `sanitizeConversationName(name: string): string` and `stripTrailingDots(name: string): string` SHALL be exported from `@epam/ai-dial-chat-shared`'s string utilities (consolidated alongside `getUtf8ByteLength`, which already lived there). Every consumer SHALL import them from `@epam/ai-dial-chat-shared`; `@epam/ai-dial-chat-hooks` SHALL neither re-export nor redeclare them, and its own modules that need one (such as `files/file-name.ts` and `skill/useSkillFileActions.ts` for `getUtf8ByteLength`) SHALL import it from `@epam/ai-dial-chat-shared` directly.
- The `RenameConversationPopup` component's `onChange` handler calls `sanitizeConversationName` so prohibited characters never appear in the field.
- Before calling `onSave`, the value is trimmed and then passed through `stripTrailingDots`.

#### Scenario: Prohibited characters are stripped while typing

- **WHEN** the user types any of `"`, `:`, `;`, `/`, `\`, `,`, `=`, `{`, `}`, `%`, `&` or a tab
- **THEN** those characters are not reflected in the input value

#### Scenario: Other special symbols are allowed

- **WHEN** the user types characters such as `!`, `@`, `#`, `$`, `^`, `*`, `(`, `)`, `-`, `_`, `+`, `[`, `]`, `|`, `~`, `'`
- **THEN** those characters appear in the input and are passed to `onSave` unchanged

#### Scenario: Trailing dots are removed before save

- **WHEN** the input value is `"My Chat..."` and Save is clicked
- **THEN** `onSave` receives `"My Chat"`

#### Scenario: Dot at the start is preserved

- **WHEN** the input value is `".hidden"`
- **THEN** `onSave` receives `".hidden"`

#### Scenario: Dot inside the name is preserved

- **WHEN** the input value is `"v1.2.release"`
- **THEN** `onSave` receives `"v1.2.release"`

#### Scenario: `chat-hooks` neither re-exports nor redeclares the utilities

- **WHEN** `libs/chat-hooks` is type-checked
- **THEN** `sanitizeConversationName`, `stripTrailingDots`, and `getUtf8ByteLength` resolve through a
  direct import from `@epam/ai-dial-chat-shared`, with no duplicate implementation in `chat-hooks`
  and no re-export from its barrel
