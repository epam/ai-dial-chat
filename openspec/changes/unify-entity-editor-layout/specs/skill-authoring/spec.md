## MODIFIED Requirements

### Requirement: Responsive layout — mobile inline accordion, desktop two-pane
At the `desktop` breakpoint, the page SHALL render the shared two-pane layout, with Cancel/Create in the page header:

- **Left panel:** the "Metadata" section (Name, Description), then the Files pane.
- **Right panel:** the "Setup" section with the selected file's editor.

At the `mobile` breakpoint, the page SHALL render a single scrolling column:

1. The Metadata section.
2. The Files pane, which starts collapsed as an "Editing file" summary row and expands in place to show the file tree.
3. The Setup section.

At `mobile`, Cancel/Create SHALL render in a `position: fixed` bottom action bar that remains reachable at any scroll position. Both breakpoints SHALL keep Back reachable in the page header.

#### Scenario: Desktop shows the two-pane layout
- **WHEN** the viewport is at the `desktop` breakpoint
- **THEN** the Metadata section and Files pane render on the left, the Setup section with the selected file renders on the right, and Cancel/Create are in the header

#### Scenario: Mobile collapses the Files pane by default
- **WHEN** the viewport is at the `mobile` breakpoint and the page first renders
- **THEN** the Metadata section renders first, the "Editing file" summary shows collapsed below it, and Cancel/Create render in a fixed bottom bar

#### Scenario: Mobile Create remains reachable while scrolled
- **WHEN** a user on `mobile` scrolls to the bottom of the Instructions editor
- **THEN** the Create and Cancel actions remain visible in the fixed bottom bar without further scrolling
