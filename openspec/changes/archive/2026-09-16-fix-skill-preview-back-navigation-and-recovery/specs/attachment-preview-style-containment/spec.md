## ADDED Requirements

### Requirement: Vendor CSS loaded by an attachment-preview engine cannot restyle the rest of the application

Vendor CSS that an attachment-preview engine pulls in SHALL be loaded so that it cannot override an application rule of equal specificity, regardless of injection order. This matters because such a stylesheet is injected when its lazy chunk loads — after the application's own stylesheet — so any rule in it that is not scoped to that engine's own class names wins on document order at equal specificity, and the effect is permanent for the session: a stylesheet is never unloaded.

Loading the vendor CSS SHALL NOT alter the computed styles of any element outside the preview surface, in any route, at any viewport width, for the remainder of the session. This SHALL hold for a CSS reset the vendor stylesheet carries and for utility class names it duplicates from the application's own design system. The engine's own presentation SHALL remain fully styled.

The containment SHALL NOT be achieved by loading the vendor CSS eagerly at application start — `attachment-canvas-package-loading` requires it to stay out of the initial load — nor by a page reload, a timer, or a reset of application state after the fact.

#### Scenario: Application layout is unchanged after a preview engine loads
- **WHEN** a user opens an attachment preview that loads a vendor-styled engine, then navigates to any other route in the application
- **THEN** every page renders exactly as it did before that engine loaded, with no page reload required

#### Scenario: A vendor CSS reset does not reach application elements
- **WHEN** the loaded vendor stylesheet contains a global reset (for example rules targeting `*`, `body`, headings, or lists)
- **THEN** the computed styles of application elements outside the preview surface are unaffected

#### Scenario: Duplicated utility class names keep their application definitions
- **WHEN** the loaded vendor stylesheet defines a class name the application's design system also defines
- **THEN** the application's definition continues to apply to application elements

#### Scenario: A responsive variant still beats a duplicated base utility
- **WHEN** an application element combines a base utility with a breakpoint variant that overrides it, and a vendor stylesheet defining that base utility loads afterwards
- **THEN** the breakpoint variant still wins at the widths where it applies, so the element's responsive behavior is unchanged

#### Scenario: The engine itself is still styled
- **WHEN** the preview renders under the containment mechanism
- **THEN** the engine's own UI is styled as it is without containment, with no unstyled flash

#### Scenario: Containment does not move the vendor CSS into the initial load
- **WHEN** the application starts and no attachment preview has been opened
- **THEN** the engine's vendor stylesheet has not been requested

### Requirement: Style containment is verified against build output and in a browser, not by unit tests

The cascade is not evaluated by the jsdom environment the project's unit tests run in, so a passing unit test SHALL NOT be treated as evidence of containment. Verification SHALL consist of an assertion over the emitted build output (that the vendor CSS is actually loaded through the containment mechanism, and that the mechanism survives the library and application builds) together with recorded browser verification of computed styles before and after the engine loads.

Browser verification SHALL cover both breakpoint presentations and both themes, and SHALL record which stylesheet wins for at least one element whose layout depends on a base utility being overridden by a breakpoint variant. Verification results SHALL be reported as what they are: build assertion, mocked test, or browser check.

#### Scenario: Build output carries the containment mechanism
- **WHEN** the library and application are built
- **THEN** the emitted CSS shows the vendor stylesheet loaded through the containment mechanism rather than as a plain unconstrained import

#### Scenario: Computed styles are recorded before and after the engine loads
- **WHEN** containment is verified in a browser
- **THEN** the computed style of at least one base-utility-plus-variant element is recorded before the engine loads and after it loads, at desktop and mobile widths, in light and dark themes, and the two match

#### Scenario: Unit tests are not reported as browser verification
- **WHEN** the change's verification is reported
- **THEN** each result states whether it came from a build assertion, a mocked test, or a browser check, and the cascade claim is supported only by the build assertion and the browser check
