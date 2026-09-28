## MODIFIED Requirements

### Requirement: Responsive layout — mobile inline accordion, desktop two-pane
At the `desktop` breakpoint, the page SHALL render the shared two-pane layout, with Cancel/Create in the page header:

- **Left panel:** the Files pane.
- **Right panel:** the selected file. For `SKILL.md` that is Name, Description and the Instructions editor.

At the `mobile` breakpoint, the page SHALL render a single scrolling column:

1. The Files pane, which starts collapsed as an "Editing file" summary row and expands in place to show the file tree.
2. The selected file.

At `mobile`, Cancel/Create SHALL render in a `position: fixed` bottom action bar that remains reachable at any scroll position. Both breakpoints SHALL keep Back reachable in the page header.

#### Scenario: Desktop shows the two-pane layout
- **WHEN** the viewport is at the `desktop` breakpoint
- **THEN** the Files pane renders on the left, the selected file renders on the right, and Cancel/Create are in the header

#### Scenario: Mobile collapses the Files pane by default
- **WHEN** the viewport is at the `mobile` breakpoint and the page first renders
- **THEN** the "Editing file" summary shows collapsed above the selected file, and Cancel/Create render in a fixed bottom bar

#### Scenario: Mobile Create remains reachable while scrolled
- **WHEN** a user on `mobile` scrolls to the bottom of the Instructions editor
- **THEN** the Create and Cancel actions remain visible in the fixed bottom bar without further scrolling
