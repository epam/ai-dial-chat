## Context

The citation pipeline already does what issue #9661 asks, apart from the label:

| Issue ask                                    | Today                                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resolve `<cit id>` against annotations       | `groupAnnotationsByCitId` + `buildCitGroupsByTagId` (`libs/quotations/src/utils/group-annotations-by-source.ts`, `citation-injection.ts`)                                                                                                                                              |
| Open the document at the page                | `getAnnotationPdfPage` → `annotationToPdfCanvasContent` (`libs/chat-hooks/src/files/attachment-canvas.ts`), triggered by marker click (`previewFilesOnMarkerClick: true`)                                                                                                             |
| Highlight a non-empty bbox                   | `annotationsToPdfHighlights` (`libs/quotations/src/utils/annotation.ts`); `pdf_bbox` and both `pdf_region` box forms are normalized                                                                                                                                                    |
| Show the page in the label                   | **Missing.** `ConversationMessageItem.buildCitationLabels` interpolates only `group.sourceName`                                                                                                                                                                                       |

The issue's wire example (`{ id, file_name, page, bbox }`) is the model's raw output. Chat receives DIAL Core's normalized `Annotation` (`body.source.attachment.title`, `body.selector` = `pdf_bbox`/`pdf_region` with `page`), which `normalizeRawAnnotations` already handles. No parsing change is needed.

Constraint from the user: some sources already put the page into the pill text, which is the attachment `title`, e.g. `clm.pdf, page 1`. Appending the page again would duplicate it.

## Goals / Non-Goals

**Goals:** the pill and its accessible name carry the cited page when one is known and the source name does not already contain it; copied text matches the pill.

**Non-Goals:** model/backend changes, new canvas behaviour, page ranges in one pill, localized page-token detection, detecting a page the model writes into the surrounding message text.

## Decisions

### D1 — A pure lib helper derives the page; the host formats the string

`getCitationGroupPage(group)` lives in `libs/quotations/src/utils/annotation.ts` next to `getAnnotationPdfPage`. It returns a number or `undefined`. The host turns that into text with `t()`. This keeps the lib free of user strings (`libs.md` "No i18n inside libs") and of host knowledge: the page comes from annotation data the lib already parses.

*Alternative:* add `page` to `AnnotationGroup`. Rejected: three grouping functions and synthetic reference groups would all have to fill it, and it widens a public interface for a derivable value.
*Alternative:* `CitationMarker` appends the page itself. Rejected: the lib would then format a user string.

### D2 — Page source order: selector, then URL fragment

The helper uses `getAnnotationPdfPage(primaryAnnotation)` first, so the label agrees with the page Preview opens. It then falls back to `parsePdfPageReference(sourceUrl).page` (`libs/quotations/src/utils/reference-attachment.ts`), which covers message-level reference attachments (`reference_url = …pdf#page=N`, grouped per URL, so per page). `annotation.ts` importing `reference-attachment.ts` adds no cycle: the latter imports only `group-annotations-by-source.ts` and `chat-shared`.

Only the **primary** annotation's page is used. For `html_tag` groups that is normally the only annotation. For multi-annotation groups the card's Prev/Next switcher already shows each one.

### D3 — Suppress when the source name already mentions a page

The pattern is case-insensitive and anchored on a page token:

```
/(?:^|[^\p{L}\p{N}])(?:pages?|pg|pp|p)\s*[.:]?\s*\d+(?![\p{L}\p{N}])|#page=\d/iu
```

It matches `page 1`, `Page:1`, `p. 3`, `P.3`, `(p.3)`, `pp. 3-5`, `pg 2`, `#page=4`. It does not match `Group1-2.pdf`, `pptx-2.pdf`, `map3.pdf` or `p2p.pdf`. The token needs a non-letter/digit boundary before it, and the digits after it must not run into a letter. These cases were checked against the regex in Node; the task 1.1 tests repeat them. Any page mention suppresses the suffix, even one naming a different page than the selector: the title is what the source chose to display, and two disagreeing numbers would be worse than one.

*Alternative:* suppress only when the same number appears anywhere in the name. Rejected: bare digits in file names (`Group1-2.pdf`) give false positives.
*Alternative:* let the host pass a predicate. Deferred: no second host needs it. The helper can take an optional predicate later without a breaking change.

### D4 — Separate i18n keys, not a conditional suffix

There are three new keys (`labelWithPage`, `labelWithPageAndOverflow`, `ariaLabelWithPage`) rather than a `{{pageSuffix}}` slot. This lets translators order source, page and count freely, which matters for RTL locales. The visible label uses `p.`; the accessible name spells out `page`, because a screen reader reads "p." poorly.

### D5 — Copy text reuses the label via an optional formatter

`replaceCitTagsWithSourceNames` gains an optional `formatLabel(group)`. The app passes a formatter built from the same keys (no overflow count, since a copied tag stands for one citation). Because the parameter is optional, the default output is byte-identical to today. The app builds the label in one helper, used by both `buildCitationLabels` and `copyContent`, so the two cannot drift.

## Risks / Trade-offs

- [A title phrased in another language ("стр. 3", "S. 3") is not detected, so the page would be shown twice] → accepted for now: titles seen so far are English or plain file names, and D3 notes a predicate parameter as the extension point.
- [Pill text gets longer and truncates sooner within `max-w-[240px]`] → the page is at the end, so the start of the file name stays visible and the full text remains in the accessible name. The existing truncation behaviour is kept.
- [Selector page and the page the model claims in the text disagree] → the label shows the selector page, which is what Preview opens. The model text is not inspected.

## Migration Plan

Additive. No persisted data or API contract changes. Rollback is a revert of the commit.

## Open Questions

- UX sign-off on the `"clm.pdf, p. 1"` format (the issue's open question, raised by Illia). The proposal follows the issue's own example. Wording changes only touch `en.json`.
