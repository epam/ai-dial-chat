## MODIFIED Requirements

### Requirement: Dismissal is content-keyed and persisted in browser storage

The system SHALL provide a close control on the banner. Dismissing SHALL persist a signature of the currently-displayed announcement to browser `localStorage` under the `TextOfClosedAnnouncement` storage key. The banner SHALL remain hidden only while the signature of the currently-configured announcement equals the stored value; if the operator changes any field the signature covers, the banner SHALL become visible again automatically without requiring a stored version counter or manual reset.

Dismissal SHALL be persistent, not session-scoped: a dismissed announcement SHALL stay hidden across browser restarts for as long as its content is unchanged.

The signature SHALL be computed by a shared, host-agnostic helper (`buildAnnouncementSignature`, exported from `@epam/ai-dial-chat-hooks`) and SHALL be deterministic for a given announcement payload. Browser-storage access SHALL stay at the app edge — the `useAnnouncementDismissal` hook under `apps/chat/src/hooks/` — because libraries must not read or write browser storage directly.

When the announcement consists only of the legacy `announcementHtml` (no title, no description), the signature SHALL be exactly that HTML string, so dismissals recorded before the structured fields existed remain valid without a storage migration. When structured content is present, the signature SHALL be a JSON payload covering the title, the description, and — only when `config.announcements` is non-empty — the announcements-popover entries behind the count pill (each rebuilt field by field as `title`, `description`, `link` so operator key order does not churn it); the legacy `announcementHtml` is excluded, matching the fact that a structured banner never renders it. Leaving `items` out when the list is empty keeps signatures stored before the popover existed valid. An entry's `severity` SHALL NOT be part of the signature: the Chat banner and popover do not render it, and adding it would change the stored signature of every deployment that configures `ANNOUNCEMENTS`, re-showing banners users already dismissed.

#### Scenario: Closing hides the banner and persists the signature

- **WHEN** the user clicks the banner close control
- **THEN** the banner is hidden AND the current announcement's signature is written to `localStorage["textOfClosedAnnouncement"]`

#### Scenario: Dismissal survives reload for the same announcement

- **WHEN** the user has dismissed an announcement and reloads the app while every configured announcement field is unchanged
- **THEN** the banner remains hidden

#### Scenario: Dismissal survives a browser restart

- **WHEN** the user has dismissed an announcement, closes the browser entirely, and reopens the app with the announcement unchanged
- **THEN** the banner remains hidden, because dismissal is persistent rather than session-scoped

#### Scenario: Changing the title or description re-shows the banner

- **WHEN** a user has dismissed an announcement and the operator later changes `ANNOUNCEMENT_TITLE` or `ANNOUNCEMENT_DESCRIPTION`
- **THEN** the banner is shown again on next load because the stored signature no longer equals the current one

#### Scenario: Adding a popover entry re-shows a structured banner

- **WHEN** a user has dismissed a structured announcement and the operator later adds an entry to the announcements list, leaving the title and description unchanged
- **THEN** the banner is shown again on next load, because the popover entries are part of the structured signature

#### Scenario: Changing the legacy message re-shows the banner

- **WHEN** a user has dismissed a legacy-only announcement and the operator later changes `ANNOUNCEMENT_HTML_MESSAGE` to different text
- **THEN** the banner is shown again on next load

#### Scenario: Changing the ignored legacy message does not re-show a structured banner

- **WHEN** a user has dismissed a structured announcement and the operator later changes only `ANNOUNCEMENT_HTML_MESSAGE`, leaving the title and description unchanged
- **THEN** the banner stays hidden, because the structured signature does not cover a message the structured layout never renders

#### Scenario: A pre-existing legacy dismissal survives the upgrade

- **WHEN** `localStorage["textOfClosedAnnouncement"]` holds a message string dismissed before the structured fields existed, and the deployment still configures only `ANNOUNCEMENT_HTML_MESSAGE` with that same string
- **THEN** the banner stays hidden after the upgrade, with no storage migration performed

#### Scenario: Severity does not change the signature

- **WHEN** two announcement payloads are identical except that one popover entry has `severity: AnnouncementSeverity.Warning` in one and `AnnouncementSeverity.Info` (or no `severity`) in the other
- **THEN** `buildAnnouncementSignature` returns the same string for both

#### Scenario: Upgrading to a backend that returns severity keeps existing dismissals

- **WHEN** a user dismissed a structured banner with popover entries before `severity` existed, and the backend now returns the same entries with `severity: "info"`
- **THEN** the banner stays hidden after the upgrade, with no storage migration performed
