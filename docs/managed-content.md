# Editing DIAL Chat content in Config Studio

This guide is for the people who edit and publish DIAL Chat's content in DIAL Config Studio: the onboarding tour, the announcement banner and its list, and the seasonal celebrations. The schema contract behind the form, and how a deployment reads published content, are in [managed-config-schema.md](managed-config-schema.md).

## Overview

The Config Studio instance for Chat (for example `ai-dial-chat` on dev) holds Chat's managed content. You work in a private draft, Studio validates it against the Chat schema, and a publisher makes it live as a new revision. Chat picks the revision up without a redeploy.

| Role on the instance | What it can do                                       |
| -------------------- | ---------------------------------------------------- |
| Schema manager       | Upload a Chat schema version                         |
| Viewer               | Read the instance, keep a private draft, export      |
| Publisher            | Publish a draft and roll back to an earlier revision |

**Save** keeps your draft; nobody else sees it. **Publish** makes it live for every Chat user, signed in or not. Never put secrets, internal-only hostnames or personal data in published content.

Pick schema version `1.1.0` in the **Edit** tab to edit announcements and celebrations; `1.0.0` has only the tour. Each version is uploaded once per environment by a schema manager from Chat's repository artifact (`apps/chat-api/managed-config-schema/ai-dial-chat-<version>.json`).

## What you can edit

A publication is one object with a `config` section; `features` stays empty for now. Leave a field out to keep the deployment's own value or Chat's default.

### Onboarding tour (`onboarding.hints`)

Hints shown one at a time, in list order, to users who have not seen them. At most 50.

| Field         | Required | Rules                                                                                                         |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `id`          | Yes      | 1–64 letters, digits, `.`, `_` or `-`. Keep it unique: when two hints share an id, only the first is shown    |
| `target`      | Yes      | The on-screen element the hint points at, chosen from the list in [onboarding anchors](onboarding-anchors.md) |
| `title`       | Yes      | Plain text, up to 100 characters                                                                              |
| `description` | No       | Plain text, up to 500 characters                                                                              |

- **Finding a target.** Open Chat with `?onboarding-anchors` added to the address (for example `https://chat.example.com/?onboarding-anchors`). Every anchor on that page is outlined instead of the tour, and the view stays on while you move around the app, until you close its panel.
- **Seen hints are remembered per browser.** Each browser stores the ids it has shown in `localStorage`. A new or changed `id` shows that hint again to everyone; editing the text or reordering hints does not. Clearing site data shows the whole tour again in that browser.
- A hint whose element is not on the current page waits for a page that shows it. Published hints appear on the home page only.

### Announcement banner (`announcement.title`, `announcement.description`)

A full-width banner at the top of Chat. Users can dismiss it; changing the title or the text shows it again to users who dismissed the previous version.

| Field                      | Rules                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `announcement.title`       | Plain text in bold at the start of the banner, up to 200 characters. Markup is shown as typed: `<b>` appears as the characters `<b>` |
| `announcement.description` | Up to 2,000 characters of text with a little HTML (below). Long text is cut to one line; a chevron expands the banner                |

**HTML that survives:** bold (`<b>`, `<strong>`), italic (`<em>`), line break (`<br>`), `<span>` and links (`<a href="…">`). Everything else is removed, and a link keeps only its address, `target` and `rel`. Links to other pages open in a new tab. Keep the text short, because the collapsed line is what most users read.

### Announcement list (`announcement.items`)

Listed behind the banner's **+N announcements** pill, in list order. At most 10.

| Field         | Required | Rules                                                                                                                        |
| ------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `title`       | Yes      | Plain text, up to 200 characters                                                                                             |
| `description` | No       | Up to 2,000 characters, the same HTML as the banner text                                                                     |
| `link`        | No       | `{ label, href }`: `label` up to 100 characters, `href` an `http://` or `https://` address up to 2,048 characters, no spaces |
| `severity`    | No       | `info` (default) or `warning`. Use `warning` for maintenance and outages                                                     |

An entry whose link address passes the form but cannot be opened (for example `https://[`) is dropped by Chat and appears only in the server log.

### Celebrations

| Field                                   | Rules                                                                                                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui.activeEventId`                      | The event on the start page: `halloween`, `new-year`, an external event, or `none` to turn celebrations off. Lowercase letters, digits and single hyphens, up to 64 characters   |
| `ui.celebrationsEnabledByDefault`       | On (default) or off: whether users who never touched **Seasonal celebrations** in Settings → Preferences see the event. A user's own choice always wins                          |
| `ui.celebrationDelivery.mode`           | `bundled` (default): built-in scenes only. `prefer-external`: also take the scenes listed in `externalScenes` from celebration packs this deployment serves                      |
| `ui.celebrationDelivery.revision`       | A restart token, 1–64 letters, digits, `.`, `_` or `-` (default `0`). Change it to restart a scene that is already playing; other policy changes restart it anyway               |
| `ui.celebrationDelivery.externalScenes` | Up to 64 `eventId/sceneId` entries, for example `new-year/snowman-delivery`. A built-in scene's ID replaces that scene; a new ID adds the pack scene to the event's click scenes |
| `ui.celebrationDelivery.externalEvents` | Up to 64 event IDs without a built-in module, for example `company-anniversary`, that come entirely from a pack                                                                  |

- **An unknown event shows nothing.** Chat does not reject an event ID it does not know; it just shows no celebration. An external event plays only when it is listed in `externalEvents` and the deployment's themes host serves its pack.
- **The pack source is not editable.** Packs always come from the deployment's own themes host. You choose among the packs it serves; you cannot point Chat anywhere else.
- **Edit the delivery fields as a set.** The deployment activates the four `ui.celebrationDelivery.*` fields together, so publish all of them consistently.

**Switching seasons.** Change `ui.activeEventId` from `halloween` to `new-year` and publish. Open Chat tabs switch on their next refresh (see [When users see a change](#when-users-see-a-change)); a playing Halloween scene stops and the New Year event takes over. To end the season, publish `none`.

### Example

This configuration passes validation against schema `1.1.0`. Paste it in the **JSON** mode of the editor, then replace the example values.

```json
{
  "config": {
    "onboarding.hints": [
      {
        "id": "tour.composer",
        "target": "conversation-input",
        "title": "Ask anything",
        "description": "Type a question or attach files."
      }
    ],
    "announcement.title": "Planned maintenance",
    "announcement.description": "Chat is read-only on <strong>Saturday 10:00 UTC</strong>.",
    "announcement.items": [
      {
        "title": "Upcoming maintenance: DIAL 1.49",
        "description": "Saturday 10:00 UTC",
        "severity": "warning"
      },
      {
        "title": "We have upgraded to DIAL 1.43",
        "link": {
          "label": "Changelog",
          "href": "https://example.com/changelog"
        }
      }
    ],
    "ui.activeEventId": "new-year",
    "ui.celebrationsEnabledByDefault": true,
    "ui.celebrationDelivery.mode": "bundled",
    "ui.celebrationDelivery.revision": "0",
    "ui.celebrationDelivery.externalScenes": [],
    "ui.celebrationDelivery.externalEvents": []
  },
  "features": {}
}
```

## Fill in and publish

1. Open the instance and select the **Edit** tab. Check that **Schema version** is `1.1.0`.
2. Edit in **Form** or **JSON** mode. In the form, lists have **Add item**, and each entry has **Move up** and **Move down**: the order is the tour order and the announcement order.
3. Select **Save draft** whenever you stop. The draft is private and survives reloads.
4. Select **Validate** and fix every reported field. Studio rejects a value that is too long, an unknown option, a link that is not `http(s)://`, or an event ID with capitals, before anything reaches Chat.
5. Select **Review and publish** (publishers only), check the changes, enter a reason and confirm.

**The whole publication is limited to 56 KiB.** Each field fits on its own, but a full tour plus ten long announcements and two full allowlists do not fit together. Studio reports the overrun when you publish; shorten the longest texts.

## Change, roll back, or move between environments

- **Change.** Edit and publish again. Every publication is a new revision; nothing is overwritten.
- **Roll back.** Open **History**, select the revision you want back, and choose **Roll back to this revision** (publishers only). The rollback is published as a new revision with that revision's values.
- **Move to another environment.** In the source environment, open **Configuration** (or a revision in **History**) and choose **Export to another environment**, then **Download file** or **Copy**. In the target environment, open **Edit**, choose **Import from file**, and publish as usual. The target must already have the same schema version uploaded. Links that point at the source environment are not rewritten, so check them in the review.

## When users see a change

Chat's backend reads the published revision about once a minute. An open, visible Chat tab refreshes its configuration about every two minutes and immediately when it regains focus, so a publication usually appears within about four minutes, and about a minute after a user returns to the tab. A reload shows it at once after the backend has read it.

If a published value does not appear:

- **The deployment still sets that value itself.** A value set in the deployment's own configuration always wins over a publication. Ask the platform team to remove it for the fields you manage.
- **The field is not active.** Each deployment chooses which fields it takes from Config Studio. Ask the platform team whether your field is active there.
- **Studio is unreachable from Chat.** Chat keeps serving the last revision it read for a while (the deployment decides how long), then falls back to the deployment's own values.

For the platform team, the variables behind these answers (`MANAGED_CONFIG_MODE`, `MANAGED_CONFIG_ACTIVE_KEYS`, the maximum staleness) are described in [managed-config-schema.md](managed-config-schema.md#runtime-reading-and-activation) and [`apps/chat-api/README.md`](../apps/chat-api/README.md#environment-variables).
