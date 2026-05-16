## ADDED Requirements

### Requirement: Input renders a textarea with a send button
The `Input` component SHALL render a `<textarea>` element and a `SendButton` inside a wrapper container. The `SendButton` SHALL be visible only when the trimmed message text is non-empty.

#### Scenario: Send button hidden when input is empty
- **WHEN** the component mounts with no `initialMessage` prop
- **THEN** the send button is not rendered

#### Scenario: Send button visible when user types text
- **WHEN** the user types non-whitespace characters into the textarea
- **THEN** the send button becomes visible

#### Scenario: Send button hidden for whitespace-only input
- **WHEN** the user enters only spaces or newlines
- **THEN** the send button is not rendered

### Requirement: Input manages message state internally
The `Input` component SHALL maintain message text in internal state initialised from the `initialMessage` prop. The `initialMessage` prop SHALL only be read on first mount; subsequent changes to `initialMessage` SHALL be ignored.

#### Scenario: Initial message pre-populates textarea
- **WHEN** `initialMessage="Hello"` is passed
- **THEN** the textarea displays "Hello" on mount

#### Scenario: Post-mount prop change does not re-initialize
- **WHEN** `initialMessage` changes after mount
- **THEN** the textarea value remains unchanged

### Requirement: Enter key submits the message
The `Input` component SHALL call `onSend` with the current message value and reset the textarea to empty when the user presses Enter without the Shift key held.

#### Scenario: Enter submits and clears
- **WHEN** the user has typed a non-empty message and presses Enter (without Shift)
- **THEN** `onSend` is called with the message text and the textarea is cleared

#### Scenario: Shift+Enter does not submit
- **WHEN** the user presses Shift+Enter
- **THEN** `onSend` is NOT called and a newline is inserted into the textarea

### Requirement: onChange callback fires on every keystroke
The `Input` component SHALL call the `onChange` prop with the current textarea value on every change event.

#### Scenario: onChange fires while typing
- **WHEN** the user types into the textarea
- **THEN** `onChange` is called with the updated value on each keystroke

### Requirement: Send button click submits the message
The `Input` component SHALL call `onSend` with the current message when the `SendButton` is clicked. The textarea SHALL NOT be cleared by a `SendButton` click (clearing on click is handled via the Enter key path; send button directly invokes `onSend`).

#### Scenario: Click send button
- **WHEN** the user clicks the `SendButton`
- **THEN** `onSend` is called with the current message value

### Requirement: Runtime theming via colors and typography props
The `Input` component SHALL map `colors` and `typography` props to `--ci-*` CSS custom variables on the wrapper element. Each CSS variable SHALL be set only when the corresponding prop field is provided.

#### Scenario: Colors applied as CSS variables
- **WHEN** `colors={{ background: '#fff', text: '#000' }}` is passed
- **THEN** `--ci-bg: #fff` and `--ci-text: #000` are set on the wrapper element

#### Scenario: Typography applied as CSS variables
- **WHEN** `typography={{ fontSize: '16px' }}` is passed
- **THEN** `--ci-font-size: 16px` is set on the wrapper element

#### Scenario: Omitted props do not produce CSS variables
- **WHEN** a color or typography field is not provided
- **THEN** no corresponding `--ci-*` variable is set on the wrapper

### Requirement: Placeholder prop customises textarea hint text
The `Input` component SHALL display the `placeholder` prop as the textarea placeholder. The default value SHALL be `"Type a message..."`.

#### Scenario: Custom placeholder displayed
- **WHEN** `placeholder="Ask anything"` is passed
- **THEN** the textarea shows "Ask anything" as the placeholder

#### Scenario: Default placeholder when prop is omitted
- **WHEN** no `placeholder` prop is provided
- **THEN** the textarea shows "Type a message..."

### Requirement: className prop adds extra CSS classes to wrapper
The `Input` component SHALL merge any `className` prop value with its own wrapper classes.

#### Scenario: Additional class applied
- **WHEN** `className="mt-4"` is passed
- **THEN** the wrapper element includes the class `mt-4`

### Requirement: Accessibility — textarea is keyboard operable
The `Input` component SHALL be fully operable via keyboard. The textarea SHALL be focusable via Tab and SHALL support all standard text-editing keyboard shortcuts.

#### Scenario: Tab focuses the textarea
- **WHEN** the user presses Tab to navigate to the input area
- **THEN** the textarea receives focus

#### Scenario: Screen reader placeholder announced
- **WHEN** the textarea is empty and focused
- **THEN** the placeholder text is announced by screen readers (via the HTML `placeholder` attribute)
