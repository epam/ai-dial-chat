## ADDED Requirements

### Requirement: The popover links to the full Usage page

The usage popover SHALL render a link to the Settings Usage tab beneath its groups, supplied through
`LimitsTab`'s existing `footerNote` prop.

The link exists because the popover deliberately shows only what needs attention: rows below the
running-low mark are omitted and the trigger disappears entirely while every limit is comfortable.
The complete picture therefore has to be reachable from somewhere, and this is the only affordance
that reaches it from the conversation.

The link SHALL target the Usage tab's own path, so it lands on Usage in one step rather than on
whichever tab a bare `/settings` happens to open. It SHALL close the popover when activated, so the
user does not arrive at the destination with a dialog still mounted over it.

`libs/catalog` SHALL gain nothing for this: the link is an app-built `ReactNode` passed through the
existing prop, and the library SHALL NOT import a router, learn a route, or grow a new prop. Its
label SHALL come from app-owned i18n under `conversationInput.usageLimits.*`.

#### Scenario: The link reaches the Usage tab in one step

- **WHEN** the user activates the popover's footer link
- **THEN** the application navigates to the Settings Usage tab, not to the Settings default tab

#### Scenario: The popover closes on navigation

- **WHEN** the footer link is activated
- **THEN** the popover is dismissed

#### Scenario: The library stays route-agnostic

- **WHEN** `libs/catalog`'s sources are inspected
- **THEN** no file imports a router or names a settings path, and `LimitsTab`'s props are unchanged
